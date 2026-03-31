import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase";

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get("code");
  if (code) {
    const supabase = supabaseClient(context);
    await supabase.auth.exchangeCodeForSession(code);
  }
  return context.redirect("/dashboard");
};