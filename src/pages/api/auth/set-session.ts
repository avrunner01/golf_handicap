import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const prerender = false;

// Bridges a client-only session (e.g. from a password-recovery link) into the
// cookie-based session the SSR pages/middleware check.
export const POST: APIRoute = async (context) => {
  const body = await context.request.json().catch(() => ({} as any));
  const access_token = typeof body.access_token === 'string' ? body.access_token : '';
  const refresh_token = typeof body.refresh_token === 'string' ? body.refresh_token : '';

  if (!access_token || !refresh_token) {
    return new Response(JSON.stringify({ error: 'Missing session tokens.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = supabaseClient(context);
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
