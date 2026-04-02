import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase";


export const POST: APIRoute = async (context) => {
  try {
    console.log("[Signout] Attempting to sign out...");
    const supabase = supabaseClient(context);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[Signout] Supabase signOut error:", error);
      return new Response("Sign out failed", { status: 500 });
    }
    console.log("[Signout] Sign out successful, redirecting to /login");
    return context.redirect("/login");
  } catch (err) {
    console.error("[Signout] Unexpected error:", err);
    return new Response("Unexpected error during sign out", { status: 500 });
  }
};
