import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Only same-origin relative paths, so the link can't bounce users off-site. */
function safeNext(next: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    return next;
  }
  return "/dashboard";
}

/**
 * Landing point for Supabase email links (password recovery today). Accepts
 * both shapes Supabase can send:
 *  - `token_hash` + `type`: from the custom email template. Works on any device.
 *  - `code`: the default PKCE link. Only works in the browser that asked for
 *    the email, because the code verifier lives in that browser's cookies.
 * On success the session cookie is set and the user goes to `next`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const next = safeNext(params.get("next"));

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) redirect("/forgot-password?error=link_expired");
  redirect(next);
}
