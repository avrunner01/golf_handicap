import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  const formData = await context.request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

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
