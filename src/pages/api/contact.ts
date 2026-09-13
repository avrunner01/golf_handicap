import type { APIRoute } from 'astro';
import { google } from 'googleapis';

const parseRequestBody = async (request: Request): Promise<Record<string, unknown>> => {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    const data = await request.json().catch(() => ({}));
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  }

  if (
    contentType.includes('multipart/form-data')
    || contentType.includes('application/x-www-form-urlencoded')
  ) {
    const formData = await request.formData().catch(() => null);
    return formData ? Object.fromEntries(formData.entries()) : {};
  }

  const rawBody = await request.text();
  if (!rawBody) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    const params = new URLSearchParams(rawBody);
    return Object.fromEntries(params.entries());
  }
};

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const errorText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  const nestedError = record.error;

  if (typeof record.message === 'string') {
    return record.message;
  }

  if (nestedError && typeof nestedError === 'object') {
    const nestedRecord = nestedError as Record<string, unknown>;
    if (typeof nestedRecord.message === 'string') {
      return nestedRecord.message;
    }
  }

  return '';
};

const classifyMailError = (details: string): string => {
  if (/invalid_grant|unauthorized_client|invalid_client|invalid credentials/i.test(details)) {
    return 'Gmail OAuth credentials are invalid. Update GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI, and GMAIL_REFRESH_TOKEN.';
  }

  if (/caller|not found|requested entity was not found|precondition check failed|forbidden/i.test(details)) {
    return 'Gmail sender/account mismatch. Ensure GMAIL_SENDER matches the Gmail account that created GMAIL_REFRESH_TOKEN and that Gmail API access is enabled.';
  }

  if (/insufficient permissions|insufficient authentication scopes|scope/i.test(details)) {
    return 'Gmail OAuth token is missing required permissions. Recreate GMAIL_REFRESH_TOKEN with Gmail send scope.';
  }

  return 'Failed to send message. Please try again later.';
};

const createRawMessage = ({
  from,
  to,
  replyTo,
  subject,
  body,
}: {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  body: string;
}) => {
  const message = [
    `From: GolfHandicap Support <${from}>`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

export const POST: APIRoute = async ({ request }) => {
  const body = await parseRequestBody(request);

  const name = normalizeText(body.name);
  const email = normalizeText(body.email);
  const subject = normalizeText(body.subject);
  const message = normalizeText(body.message);

  if (!name || !email || !subject || !message) {
    return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isValidEmail(email)) {
    return new Response(JSON.stringify({ error: 'Please provide a valid email address.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const gmailClientId = normalizeText(import.meta.env.GMAIL_CLIENT_ID ?? process.env.GMAIL_CLIENT_ID);
  const gmailClientSecret = normalizeText(import.meta.env.GMAIL_CLIENT_SECRET ?? process.env.GMAIL_CLIENT_SECRET);
  const gmailRedirectUri = normalizeText(import.meta.env.GMAIL_REDIRECT_URI ?? process.env.GMAIL_REDIRECT_URI);
  const gmailRefreshToken = normalizeText(import.meta.env.GMAIL_REFRESH_TOKEN ?? process.env.GMAIL_REFRESH_TOKEN);
  const gmailSender = normalizeText(import.meta.env.GMAIL_SENDER ?? process.env.GMAIL_SENDER);
  const contactRecipient = normalizeText(
    import.meta.env.CONTACT_RECEIVER
      ?? process.env.CONTACT_RECEIVER
      ?? gmailSender
  );

  const missingConfigKeys = [
    ['GMAIL_CLIENT_ID', gmailClientId],
    ['GMAIL_CLIENT_SECRET', gmailClientSecret],
    ['GMAIL_REDIRECT_URI', gmailRedirectUri],
    ['GMAIL_REFRESH_TOKEN', gmailRefreshToken],
    ['GMAIL_SENDER', gmailSender],
    ['CONTACT_RECEIVER', contactRecipient],
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missingConfigKeys.length > 0) {
    return new Response(JSON.stringify({
      error: 'Email service is not configured on the server.',
      details: import.meta.env.DEV
        ? `Missing env keys: ${missingConfigKeys.join(', ')}`
        : undefined,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const oauth2Client = new google.auth.OAuth2(gmailClientId, gmailClientSecret, gmailRedirectUri);
  oauth2Client.setCredentials({ refresh_token: gmailRefreshToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const mailSubject = `[GolfHandicap Contact] ${subject}`;
  const mailBody = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Submitted: ${new Date().toISOString()}`,
    '',
    message,
  ].join('\n');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: createRawMessage({
          from: gmailSender,
          to: contactRecipient,
          replyTo: email,
          subject: mailSubject,
          body: mailBody,
        }),
      },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorRecord = (error && typeof error === 'object')
      ? (error as Record<string, unknown>)
      : null;
    const responseData = errorRecord?.response;
    const details = [
      errorText(error),
      errorText(responseData),
      errorText((responseData && typeof responseData === 'object')
        ? (responseData as Record<string, unknown>).data
        : null),
    ].filter(Boolean).join(' | ');

    const userError = classifyMailError(details);

    console.error('Contact API send failure', {
      details,
      sender: gmailSender,
      recipient: contactRecipient,
    });

    return new Response(JSON.stringify({
      error: userError,
      details: import.meta.env.DEV ? details || undefined : undefined,
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
