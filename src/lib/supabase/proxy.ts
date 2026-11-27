import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard"];
// Signed-in users skip these. /reset-password and /forgot-password are
// deliberately absent: a recovery link signs the user in, and if their
// recovery cookie expires they must still be able to request a new link.
const AUTH_ROUTES = ["/login", "/signup"];

/**
 * Refreshes the Supabase auth session on every matched request and applies
 * coarse route protection. Called from `src/proxy.ts` (Next.js 16's renamed
 * Middleware). This keeps the session cookie fresh so Server Components and
 * Server Actions always see a valid user.
 *
 * Per the Next.js auth guidance, this is an *optimistic* check — the real
 * authorization boundary is RLS in Postgres plus `requireProfile()` in each
 * protected page and Server Action.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Sent by @supabase/ssr with new session cookies, so that no shared cache
  // stores the response and hands one user's session to another.
  let noCacheHeaders: Record<string, string> = {};

  const setHeaders = (target: NextResponse) =>
    Object.entries(noCacheHeaders).forEach(([name, value]) =>
      target.headers.set(name, value),
    );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          noCacheHeaders = headers;
          setHeaders(response);
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => path.startsWith(p));

  // Only page loads are redirected. A Server Action is a POST to the page's own
  // path, and redirecting it re-posts the action to a route that can't run it.
  // Actions are let through to do their own auth checks.
  if (request.method !== "GET" && request.method !== "HEAD") return response;

  // A redirect is a new response, so it has to carry over whatever Supabase
  // just set: refreshed or cleared session cookies and their headers.
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    setHeaders(redirect);
    return redirect;
  };

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", path);
    return redirectTo(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectTo(url);
  }

  return response;
}
