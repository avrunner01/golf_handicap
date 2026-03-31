import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = supabaseClient(context);
  await supabase.auth.signOut();
  return context.redirect("/login");
};
