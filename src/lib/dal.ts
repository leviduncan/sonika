import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer. The single place server code asks "who is this user and
 * what agency are they in?". `cache()` dedupes the lookups within one render
 * pass. RLS is the real isolation boundary; these helpers are the convenience
 * + redirect layer on top of it.
 */

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

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

/** Fetch the signed-in user's profile + their agency, or null if signed out. */
export const getProfile = cache(async (): Promise<AgencyProfile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, agency_id, email, full_name, role, agency:agencies(id, name, slug, stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id, subscription_status)",
    )
    .eq("id", user.id)
    .single();

  return (data as AgencyProfile | null) ?? null;
});

/**
 * Guard for protected pages/actions. Redirects to /login when signed out, and
 * returns the resolved profile so callers don't re-query.
 */
export const requireProfile = cache(async (): Promise<AgencyProfile> => {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
});
