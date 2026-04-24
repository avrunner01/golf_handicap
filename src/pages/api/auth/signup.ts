import type { APIRoute } from 'astro';
import { supabaseClient, trySupabaseAdmin } from '../../../lib/supabase';

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const formData = await context.request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const username = formData.get('username') as string;
  const full_name = formData.get('full_name') as string;
  const current_handicap_index = parseFloat(formData.get('current_handicap_index') as string);

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
    // Try to insert, if conflict, update (use service-role to bypass trigger RLS)
    const db = trySupabaseAdmin();
    if (!db) {
      return new Response(JSON.stringify({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { error: insertError } = await (db as any).from('profiles').insert(profile, { onConflict: 'id' });
    if (insertError && insertError.message && insertError.message.includes('duplicate key value')) {
      // Profile exists, update it
      await (db as any).from('profiles').update({
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
