import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

let _adminClient: ReturnType<typeof createClient> | null = null;

export const supabaseAdmin = () => {
  if (_adminClient) return _adminClient;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  _adminClient = createClient(import.meta.env.SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _adminClient;
};

export const supabaseClient = (context: any) => {
  const client = createServerClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          const cookies = parseCookieHeader(context.request.headers.get('Cookie') ?? '');
          const found = cookies.find((cookie: { name: string; value?: string }) => cookie.name === name);
          return found && typeof found.value === 'string' ? found.value : undefined;
        },
        set(name: string, value: string, options?: any) {
          context.cookies.set(name, value, options);
        },
        remove(name: string, options?: any) {
          context.cookies.delete(name, options);
        },
      },
    }
  );

  // Wrap getUser to handle stale refresh tokens gracefully
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (...args: any[]) => {
    const result = await originalGetUser(...args);
    if (result.error?.code === 'refresh_token_not_found') {
      // Clear stale auth cookies so the user gets a clean login
      try {
        await client.auth.signOut();
      } catch (_) {}
    }
    return result;
  };

  return client;
}