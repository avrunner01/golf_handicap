import type { APIRoute } from 'astro';
import sgMail from '@sendgrid/mail';

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
      statusCode?: number;
      body?: {
        errors?: Array<{ message?: string }>;
      };
    } | undefined;

    if (response?.statusCode === 429) {
      return 'Contact notification rate limit reached. Please try again in about an hour or email support directly.';
    }

    const firstErrorMessage = response?.body?.errors?.[0]?.message;
    if (typeof firstErrorMessage === 'string' && firstErrorMessage.trim()) {
      return firstErrorMessage;
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













  const sendGridApiKey = normalizeText(import.meta.env.SENDGRID_API_KEY ?? process.env.SENDGRID_API_KEY);
  const contactRecipient = normalizeText(
    import.meta.env.CONTACT_RECEIVER
      ?? process.env.CONTACT_RECEIVER
      ?? import.meta.env.GMAIL_SENDER
      ?? process.env.GMAIL_SENDER
  );
  const fromEmail = normalizeText(
    import.meta.env.SENDGRID_FROM_EMAIL
      ?? process.env.SENDGRID_FROM_EMAIL
      ?? process.env.CONTACT_SENDER
      ?? contactRecipient
  );

  const missingConfigKeys = [
    ['SENDGRID_API_KEY', sendGridApiKey],
    ['CONTACT_RECEIVER', contactRecipient],
    ['SENDGRID_FROM_EMAIL', fromEmail],
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missingConfigKeys.length > 0) {
    return new Response(JSON.stringify({
      error: 'Email service is not configured on the server.',
      details: import.meta.env.DEV ? `Missing env keys: ${missingConfigKeys.join(', ')}` : undefined,
    }), {
      status: 500,
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
    sgMail.setApiKey(sendGridApiKey);

    await sgMail.send({
      to: contactRecipient,
      from: fromEmail,
      replyTo: email,
      subject: `[Contact Form] ${sanitizeHeaderText(subject)}`,
      text: emailText,
      html: emailHtml,
    });

    console.info('Contact form submitted', {
      name,
      email,
      subject,
      message,
      notifiedRecipient: contactRecipient,
      submittedAt: new Date().toISOString(),
      deliveryMode: 'sendgrid',
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

    console.error('SendGrid contact email failure', {
      details,
      recipient: contactRecipient,
      sender: fromEmail,
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
