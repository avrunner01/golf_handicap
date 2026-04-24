import type { APIRoute } from 'astro';
import { supabaseAdmin, supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const { id } = await context.request.json();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if user is admin (by email, adjust as needed)
  const isAdmin = user.email === "avrunner01@gmail.com";
  const db = supabaseAdmin();

  let query = (db as any).from('rounds').delete().eq('id', id);
  if (!isAdmin) {
    query = query.eq('profile_id', user.id);
  }
  const { error } = await query;

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
