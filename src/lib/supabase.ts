import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

let _adminClient: ReturnType<typeof createClient> | null = null;

const isResponseAlreadySentError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'ResponseSentError'
    || error.message.includes('response has already been sent');
};

export const supabaseAdmin = () => {
  if (_adminClient) return _adminClient;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  _adminClient = createClient(import.meta.env.SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _adminClient;
};

export const trySupabaseAdmin = () => {
  try {
    return supabaseAdmin();
  } catch {
    return null;
  }
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
          try {
            context.cookies.set(name, value, options);
          } catch (error) {
            if (!isResponseAlreadySentError(error)) {
              throw error;
            }
          }
        },
        remove(name: string, options?: any) {
          try {
            context.cookies.delete(name, options);
          } catch (error) {
            if (!isResponseAlreadySentError(error)) {
              throw error;
            }
          }
        },
      },
    }
  );

  return client;
}