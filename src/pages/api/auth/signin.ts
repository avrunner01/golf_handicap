import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const prerender = false;

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

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const body = await parseRequestBody(context.request);
  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (password.length < 6) {
    return new Response(JSON.stringify({ error: 'Password must be at least 6 characters.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    let msg = error.message;
    if (msg && msg.toLowerCase().includes('invalid login credentials')) {
      // Check if the user exists
      let userExists = false;
      try {
        const { data: userData } = await supabase.auth.admin.listUsers();
        if (userData && userData.users) {
          userExists = userData.users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase());
        }
      } catch (e) {}
      if (!userExists) {
        msg = 'No user account, please Sign Up';
        return new Response(JSON.stringify({ error: msg }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        msg = 'Incorrect password. Try again.';
        return new Response(JSON.stringify({ error: msg }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Redirect to dashboard after successful signin
  return context.redirect('/dashboard');
};
