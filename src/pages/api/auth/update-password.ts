import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase";

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  const password = formData.get("password");
  if (!password || typeof password !== "string") {
    return new Response(JSON.stringify({ error: "Password is required." }), { status: 400 });
  }
  const supabase = supabaseClient(context);
  // Get the user from the session (should be set by Supabase after reset link)
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "User not authenticated." }), { status: 401 });
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
