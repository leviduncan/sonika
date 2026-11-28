import { assertReadyToTest, restoreProfilesRead, resumeGateway } from "./local-supabase";

/**
 * Throwing here aborts the whole suite before any test touches Supabase.
 *
 * The returned teardown is a safety net behind each spec's own restore hooks.
 * It only exists once the guard has passed: after a refusal nothing has been
 * changed, so there is nothing to restore.
 */
export default async function globalSetup() {
  await assertReadyToTest();

  return async function globalTeardown() {
    const results = await Promise.allSettled([resumeGateway(), restoreProfilesRead()]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
  };
}
