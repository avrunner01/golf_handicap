import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase";

const parseRequestBody = async (request: Request): Promise<Record<string, unknown>> => {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    const data = await request.json().catch(() => ({}));
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  }

  if (
    contentType.includes('multipart/form-data')
    || contentType.includes('application/x-www-form-urlencoded')
  ) {
    const formData = await request.formData().catch(() => null);
    return formData ? Object.fromEntries(formData.entries()) : {};
  }

  const fallbackFormData = await request.formData().catch(() => null);
  if (fallbackFormData) {
    return Object.fromEntries(fallbackFormData.entries());
  }

  const rawBody = await request.text();
  if (!rawBody) {
    return {};
  }

  try {
    const json = JSON.parse(rawBody);
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  } catch {
    const params = new URLSearchParams(rawBody);
    return Object.fromEntries(params.entries());
  }
};

export const POST: APIRoute = async (context) => {
  const body = await parseRequestBody(context.request);
  const password = body.password;
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
