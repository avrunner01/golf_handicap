// API endpoint to create a new golfer profile
import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const formData = await context.request.formData();
  const username = formData.get('username') as string;
  const full_name = formData.get('full_name') as string;
  const current_handicap_index = parseFloat(formData.get('current_handicap_index') as string);
  const updated_at = new Date().toISOString();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return context.redirect('/login');
  }

  // Insert profile with user id
  const { data, error } = await supabase
    .from('profiles')
    .insert([
      {
        id: user.id, // associate profile with auth user id
        username,
        full_name,
        current_handicap_index,
        updated_at
      }
    ])
    .select()
    .single();

  if (error) {
    let msg = error.message;
    if (msg && msg.includes('duplicate key value violates unique constraint')) {
      msg = 'A profile already exists for this user.';
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Success: return JSON so frontend can handle
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
