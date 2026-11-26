/**
 * Where an auth email link may send the user after it is verified. An exact
 * allowlist, not a "looks relative" check: prefix rules keep missing browser
 * quirks (`//host`, `/\host`, `/\t/host` all leave the site).
 *
 * Kept free of server-only imports so the Playwright suite can unit-test it.
 */
export const ALLOWED_NEXT_PATHS = ["/reset-password", "/dashboard"] as const;

export type AllowedNextPath = (typeof ALLOWED_NEXT_PATHS)[number];

const DEFAULT_NEXT: AllowedNextPath = "/dashboard";

export function safeNext(next: unknown): AllowedNextPath {
  return (ALLOWED_NEXT_PATHS as readonly unknown[]).includes(next)
    ? (next as AllowedNextPath)
    : DEFAULT_NEXT;
}
