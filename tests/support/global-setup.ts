import { assertReadyToTest } from "./local-supabase";

/** Throwing here aborts the whole suite before any test touches Supabase. */
export default async function globalSetup() {
  await assertReadyToTest();
}
