import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase";

export const GET: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${context.url.origin}/api/auth/callback`,
    },
  });

  if (error) return new Response(error.message, { status: 500 });
  return context.redirect(data.url);
};