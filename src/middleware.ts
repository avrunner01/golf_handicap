import { defineMiddleware } from "astro:middleware";
import { supabaseClient } from "./lib/supabase";

// Define which routes are protected
const PROTECTED_ROUTES = ["/dashboard", "/profile", "/add-round", "/add-course"];

export const onRequest = defineMiddleware(async (context, next) => {
  const isProtectedRoute = PROTECTED_ROUTES.some((path) =>
    context.url.pathname.startsWith(path)
  );

  // Only run session check on protected routes to save performance
  if (isProtectedRoute) {
    const supabase = supabaseClient(context);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // If no authenticated user or error, redirect to login
    if (!user || error) {
      return context.redirect("/login?error=unauthorized");
    }
  }

  // If public route or authenticated, continue as normal
  return next();
});