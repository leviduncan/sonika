import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createDeadline,
  isAuthUnavailable,
  SupabaseUnavailableError,
} from "@/lib/supabase/deadline";

/**
 * Data Access Layer. The single place server code asks "who is this user and
 * what agency are they in?". `cache()` dedupes the lookups within one render
 * pass. RLS is the real isolation boundary; these helpers are the convenience
 * + redirect layer on top of it.
 *
 * The lookups give up after a few seconds and throw, which shows the error
 * page. "Unknown" is never read as signed in or as signed out.
 */

/** One client and one time budget for the lookups behind a page or action. */
async function connect() {
  const limit = createDeadline();
  return { limit, supabase: await createClient(limit) };
}

async function readUser({ limit, supabase }: Awaited<ReturnType<typeof connect>>) {
  const { data, error } = await limit.within(supabase.auth.getUser());
  if (isAuthUnavailable(error)) throw new SupabaseUnavailableError({ cause: error });
  return error ? null : data.user;
}

export const getUser = cache(async () => readUser(await connect()));

export type Agency = {
  id: string;
  name: string;
  slug: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_item_id: string | null;
  subscription_status: string;
};

export type AgencyProfile = {
  id: string;
  agency_id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "admin" | "member";
  agency: Agency;
};

/**
 * The signed-in user and their profile + agency. `profile` is null when signed
 * out or when there is no profile row. A failed query throws: it says nothing
 * about either.
 */
export const getAccount = cache(async () => {
  const connection = await connect();
  const user = await readUser(connection);
  if (!user) return { user: null, profile: null };

  // Same client as above, so the query carries any session just refreshed.
  const { data, error } = await connection.limit.within(
    connection.supabase
      .from("profiles")
      .select(
        "id, agency_id, email, full_name, role, agency:agencies(id, name, slug, stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id, subscription_status)",
      )
      .eq("id", user.id)
      .maybeSingle(),
  );

  if (error) throw new Error("Profile lookup failed", { cause: error });
  return { user, profile: data as AgencyProfile | null };
});

/**
 * Guard for protected pages/actions. Returns the resolved profile so callers
 * don't re-query. Signed out goes to /login. Signed in without a profile goes
 * to /account-unavailable: the proxy bounces signed-in users off /login, so
 * sending them there would loop.
 */
export const requireProfile = cache(async (): Promise<AgencyProfile> => {
  const { user, profile } = await getAccount();
  if (!user) redirect("/login");
  if (!profile) redirect("/account-unavailable");
  return profile;
});
