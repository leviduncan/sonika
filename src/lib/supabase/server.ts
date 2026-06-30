import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (Server Components, Server Actions, Route
 * Handlers). Uses the anon key + the request's auth cookies, so reads and
 * writes are RLS-scoped to the signed-in user's agency.
 *
 * In Next.js 16 `cookies()` is async, so this is too.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, where setting
            // cookies isn't allowed. Safe to ignore — the proxy refreshes
            // the session cookie on every request instead.
          }
        },
      },
    },
  );
}
