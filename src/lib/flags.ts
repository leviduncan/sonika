/**
 * Public feature flags — safe to read in the browser (NEXT_PUBLIC_*, inlined at
 * build). Keep server-only secrets out of here.
 */

/**
 * Whether public sign-up is open. Off by default so the landing page stays a
 * "parked" teaser; flip NEXT_PUBLIC_SIGNUP_OPEN=1 at go-live to surface the
 * Sign up / Log in links (no code change). The /signup + /login pages work
 * regardless — this only controls whether the home page links to them.
 */
export function isSignupOpen(): boolean {
  const v = (process.env.NEXT_PUBLIC_SIGNUP_OPEN ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
