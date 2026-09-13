import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

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
  const username = typeof body.username === 'string' ? body.username : '';
  const full_name = typeof body.full_name === 'string' ? body.full_name : '';
  const current_handicap_index = parseFloat(typeof body.current_handicap_index === 'string' ? body.current_handicap_index : '');

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    let msg = error.message;
    if (msg && msg.toLowerCase().includes('user already registered')) {
      msg = 'An account with this email already exists. Please log in.';
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // If signup is successful, create profile
  if (data && data.user) {
    const profile = {
      id: data.user.id,
      username,
      full_name,
      current_handicap_index: isNaN(current_handicap_index) ? 0 : current_handicap_index,
      updated_at: new Date().toISOString(),
    };
    // Try to insert, if conflict, update
    const { error: insertError } = await supabase.from('profiles').insert(profile, { onConflict: 'id' });
    if (insertError && insertError.message && insertError.message.includes('duplicate key value')) {
      // Profile exists, update it
      await supabase.from('profiles').update({
        username,
        full_name,
        current_handicap_index: isNaN(current_handicap_index) ? 0 : current_handicap_index,
        updated_at: new Date().toISOString(),
      }).eq('id', data.user.id);
    }
  }

  // Redirect to login page after signup attempt
  return context.redirect('/login');
};
