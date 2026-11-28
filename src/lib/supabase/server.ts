import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Deadline } from "@/lib/supabase/deadline";

/**
 * Server-side Supabase client (Server Components, Server Actions, Route
 * Handlers). Uses the anon key + the request's auth cookies, so reads and
 * writes are RLS-scoped to the signed-in user's agency.
 *
 * In Next.js 16 `cookies()` is async, so this is too.
 *
 * Pass a `limit` to bound how long this client's requests may take.
 */
export async function createClient(limit?: Deadline) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: limit && { fetch: limit.fetch },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          if (limit?.signal.aborted) return;
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, where setting
            // cookies isn't allowed. Safe to ignore: src/proxy.ts refreshes
            // the session and saves the cookie before the page renders.
          }
        },
      },
    },
  );
}
