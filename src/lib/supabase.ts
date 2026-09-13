import { createServerClient, parseCookieHeader } from '@supabase/ssr'

export const supabaseClient = (context: any) => {
  return createServerClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          // Prefer Astro's parsed cookie API because some adapters do not
          // consistently expose the raw Cookie header on every request path.
          const cookieStore = context.cookies;
          if (cookieStore && typeof cookieStore.get === 'function') {
            const cookie = cookieStore.get(name);
            if (cookie && typeof cookie.value === 'string') {
              return cookie.value;
            }
          }

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
  )
}