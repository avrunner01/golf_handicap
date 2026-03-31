import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const post: APIRoute = async ({ request, cookies }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let email = '';
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({} as any));
      email = String(body.email || '').trim();
    } else {
      const form = await request.formData().catch(() => new FormData());
      email = String(form.get('email') || '').trim();
    }

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: { message: 'Email is required' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL('/reset-password', request.url).toString(),
    });

    if (error) {
      const msg = (error as any).code === 'over_email_send_rate_limit' || (error as any).status === 429
        ? 'Try again in an hour; check your inbox or contact support.'
        : (error as any).message || 'Failed to request password reset';
      return new Response(JSON.stringify({ success: false, error: { message: msg }, data: { success: false, error: { message: msg } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const message = 'Check your email for the reset link';
    return new Response(JSON.stringify({ success: true, message, data: { success: true, message } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: { message: err instanceof Error ? err.message : 'Server error' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export async function POST(ctx: Parameters<APIRoute>[0]) {
  return post(ctx as any) as any;
}
