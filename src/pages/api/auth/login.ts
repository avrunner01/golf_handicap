import type { APIRoute } from 'astro';

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

  const fallbackFormData = await request.formData().catch(() => null);
  if (fallbackFormData) {
    return Object.fromEntries(fallbackFormData.entries());
  }

  const rawBody = await request.text();
  if (!rawBody) {
    return {};
  }

  try {
    const json = JSON.parse(rawBody);
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  } catch {
    const params = new URLSearchParams(rawBody);
    return Object.fromEntries(params.entries());
  }
};

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const body = await parseRequestBody(request);
  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) return new Response('Missing fields', { status: 400 });

  const { error } = await locals.supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return new Response(error.message, { status: 401 });

  return redirect('/dashboard');
};