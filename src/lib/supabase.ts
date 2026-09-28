import { createServerClient } from '@supabase/ssr'
import { parse as parseCookie } from 'cookie'

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

          const parsedCookies = parseCookie(context.request.headers.get('Cookie') ?? '');
          const value = parsedCookies?.[name];
          return typeof value === 'string' ? value : undefined;
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