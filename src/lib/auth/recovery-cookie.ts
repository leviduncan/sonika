import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Proof that this browser just verified a password-recovery link. A recovery
 * link and a password login both produce an ordinary Supabase session, so the
 * session alone can't tell them apart. `updatePassword` requires this cookie,
 * which means a session from a normal sign-in (or a stolen one) can't change
 * the password without the email.
 *
 * Value: `<userId>.<expiresAtEpochSeconds>.<hmac>`, HMAC-SHA256 over the first
 * two parts. Bound to the user so it can't carry over to another account.
 */
export const RECOVERY_COOKIE = "sonika_recovery";
const TTL_SECONDS = 15 * 60;

/**
 * Signing key. Prefer a dedicated RECOVERY_COOKIE_SECRET; otherwise derive
 * one from the service-role key (already a server-only secret in every
 * environment) so no new deploy step is needed. Fails closed when neither is set.
 */
let warnedShortSecret = false;

function signingKey(): Buffer | null {
  const dedicated = process.env.RECOVERY_COOKIE_SECRET;
  if (dedicated && dedicated.length >= 32) return Buffer.from(dedicated);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (dedicated && !warnedShortSecret) {
    warnedShortSecret = true;
    console.warn(
      serviceKey
        ? "[auth] RECOVERY_COOKIE_SECRET is shorter than 32 characters and is ignored; using the key derived from SUPABASE_SERVICE_ROLE_KEY."
        : "[auth] RECOVERY_COOKIE_SECRET is shorter than 32 characters and is ignored.",
    );
  }

  if (serviceKey) {
    return createHmac("sha256", serviceKey).update("sonika:recovery-cookie:v1").digest();
  }

  console.error(
    "[auth] No RECOVERY_COOKIE_SECRET (32+ chars) or SUPABASE_SERVICE_ROLE_KEY set; password reset is disabled.",
  );
  return null;
}

function sign(payload: string, key: Buffer) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** Returns false when no signing key is configured (reset can't proceed). */
export async function setRecoveryCookie(userId: string): Promise<boolean> {
  const key = signingKey();
  if (!key) return false;

  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  (await cookies()).set(RECOVERY_COOKIE, `${payload}.${sign(payload, key)}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return true;
}

export async function hasValidRecoveryCookie(userId: string): Promise<boolean> {
  const key = signingKey();
  if (!key) return false;

  const raw = (await cookies()).get(RECOVERY_COOKIE)?.value;
  const parts = raw?.split(".");
  if (!parts || parts.length !== 3) return false;

  const [cookieUserId, expiresAtRaw, signature] = parts;
  const expected = Buffer.from(sign(`${cookieUserId}.${expiresAtRaw}`, key));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

  const expiresAt = Number(expiresAtRaw);
  return (
    cookieUserId === userId && Number.isInteger(expiresAt) && expiresAt > Date.now() / 1000
  );
}

export async function clearRecoveryCookie() {
  (await cookies()).delete(RECOVERY_COOKIE);
}
