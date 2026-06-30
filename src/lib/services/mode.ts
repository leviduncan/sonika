import "server-only";

/** Read a boolean-ish env flag. True for "1"/"true"/"yes" (case-insensitive). */
export function envFlag(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Force the whole provisioning chain (Claude prompt, Vapi, Twilio) to use its
 * mock path even when real API keys are present. Lets you keep live keys in
 * .env.local for convenience while developing without spending money — real
 * provisioning then becomes a deliberate opt-out, not on-by-accident.
 *
 * Set PROVISIONING_MOCK=1 (or true/yes) to force mocks.
 */
export function isMockProvisioning(): boolean {
  return envFlag("PROVISIONING_MOCK");
}
