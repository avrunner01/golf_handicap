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

const sanitizeHeaderText = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const classifySendError = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const response = record.response as {
      status?: number;
      data?: { error?: string; error_description?: string };
    } | undefined;
    const googleError = `${response?.data?.error || ''} ${response?.data?.error_description || ''}`;
    if (/invalid_grant/i.test(googleError) || /invalid_grant/i.test(String(record.message || ''))) {
      return 'Gmail authorization has expired or been revoked. Generate a new refresh token for the current OAuth client.';
    }
    if (/unauthorized_client/i.test(googleError) || /unauthorized_client/i.test(String(record.message || ''))) {
      return 'The Gmail refresh token belongs to a different OAuth client. Generate it with the exact client ID and secret configured on this server.';
    }
    if (response?.status === 401) {
      return 'Gmail authentication failed. Check the OAuth client and refresh token.';
    }
    if (response?.status === 429) {
      return 'Gmail sending is temporarily rate-limited. Please try again later.';
    }

    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
  }

  return 'Failed to send contact notification. Please try again later.';
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













  const gmailClientId = normalizeText(import.meta.env.GMAIL_CLIENT_ID || process.env.GMAIL_CLIENT_ID);
  const gmailClientSecret = normalizeText(import.meta.env.GMAIL_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET);
  const gmailRefreshToken = normalizeText(import.meta.env.GMAIL_REFRESH_TOKEN || process.env.GMAIL_REFRESH_TOKEN);
  const gmailSender = normalizeText(import.meta.env.GMAIL_SENDER || process.env.GMAIL_SENDER);
  const contactRecipient = normalizeText(
    import.meta.env.CONTACT_RECEIVER
      || process.env.CONTACT_RECEIVER
  );

  const missingConfigKeys = [
    ['GMAIL_CLIENT_ID', gmailClientId],
    ['GMAIL_CLIENT_SECRET', gmailClientSecret],
    ['GMAIL_REFRESH_TOKEN', gmailRefreshToken],
    ['GMAIL_SENDER', gmailSender],
    ['CONTACT_RECEIVER', contactRecipient],
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missingConfigKeys.length > 0) {
    return new Response(JSON.stringify({
      error: 'Gmail email service is not configured on the server.',
      details: import.meta.env.DEV ? `Missing env keys: ${missingConfigKeys.join(', ')}` : 'Configure Gmail OAuth2 credentials on the server.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const emailText = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    '',
    'Message:',
    message,
  ].join('\n');

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <p><strong>Message:</strong></p>
      <div style="white-space: pre-wrap; background: #f3f4f6; padding: 16px; border-radius: 8px; margin-top: 8px;">${escapeHtml(message)}</div>
    </div>
  `;

  try {
    const auth = new google.auth.OAuth2(gmailClientId, gmailClientSecret);
    auth.setCredentials({ refresh_token: gmailRefreshToken });
    const gmail = google.gmail({ version: 'v1', auth });
    const rawMessage = [
      `From: ${gmailSender}`,
      `To: ${contactRecipient}`,
      `Reply-To: ${email}`,
      `Subject: [Contact Form] ${sanitizeHeaderText(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="contact-boundary"',
      '',
      '--contact-boundary',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      emailText,
      '--contact-boundary',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      emailHtml,
      '--contact-boundary--',
    ].join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    console.info('Contact form submitted', {
      name,
      email,
      subject,
      message,
      notifiedRecipient: contactRecipient,
      submittedAt: new Date().toISOString(),
      deliveryMode: 'gmail',
    });

    return new Response(JSON.stringify({
      ok: true,
      message: "Message sent. I'll get back to you with your request.",
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown server error';

    console.error('Gmail contact email failure', {
      details,
      recipient: contactRecipient,
      sender: gmailSender,
    });

    return new Response(JSON.stringify({
      error: classifySendError(error),
      details: import.meta.env.DEV ? details || undefined : undefined,
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
