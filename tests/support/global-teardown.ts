import { restoreProfilesRead, resumeGateway } from "./local-supabase";

/** Safety net behind each spec's own restore hooks. */
export default async function globalTeardown() {
  const results = await Promise.allSettled([resumeGateway(), restoreProfilesRead()]);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
}
