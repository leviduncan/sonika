import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES Row-Level Security — use only on
 * the server for trusted, system-level writes (Vapi/Stripe webhooks,
 * provisioning, any bootstrap that runs before a user has an agency).
 *
 * `server-only` makes importing this from client code a build error, so the
 * service-role key can never reach the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
