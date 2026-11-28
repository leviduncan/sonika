import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";

/** How long to wait on Supabase before treating the answer as unknown. */
export const SUPABASE_TIMEOUT_MS = 3000;

export class SupabaseUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("Supabase is unavailable", options);
    this.name = "SupabaseUnavailableError";
  }
}

export type Deadline = ReturnType<typeof createDeadline>;

/**
 * One time budget for the Supabase calls made through one client. Aborting the
 * request alone isn't enough, because auth-js retries a failed refresh for
 * about 30 s. So `within()` stops waiting, aborts what is in flight, and leaves
 * any later request unanswered. Callers must also ignore cookie writes once
 * `signal` is aborted.
 */
export function createDeadline(ms = SUPABASE_TIMEOUT_MS) {
  const controller = new AbortController();
  const endsAt = Date.now() + ms;

  const boundFetch: typeof fetch = (input, init) => {
    // Never settles on purpose: an error here would start another retry.
    if (controller.signal.aborted) return new Promise<Response>(() => {});
    const signal = init?.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;
    return fetch(input, { ...init, signal });
  };

  /** Resolves with `work`, or throws once the budget is spent. */
  async function within<T>(work: PromiseLike<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new SupabaseUnavailableError());
      }, Math.max(0, endsAt - Date.now()));
    });
    try {
      return await Promise.race([work, expired]);
    } finally {
      clearTimeout(timer);
    }
  }

  return { signal: controller.signal, fetch: boundFetch, within };
}

/**
 * True when an auth error says nothing about whether the user is signed in: the
 * server couldn't be reached, failed, rate limited, or answered unreadably.
 */
export function isAuthUnavailable(error: AuthError | null) {
  if (!error) return false;
  const status = error.status ?? 0;
  return (
    isAuthRetryableFetchError(error) ||
    error.name === "AuthUnknownError" ||
    status === 429 ||
    status >= 500
  );
}
