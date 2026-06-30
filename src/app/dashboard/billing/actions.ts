"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isBillingEnabled,
  ensureCustomer,
  createCheckoutSession,
  createPortalSession,
} from "@/lib/services/stripe";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Start (or resume) the per-seat subscription via Stripe Checkout. */
export async function startCheckout(): Promise<void> {
  const profile = await requireProfile();
  if (!isBillingEnabled()) return;

  const admin = createAdminClient();

  // Ensure the agency has a Stripe customer (agencies are only writable via the
  // service role — no RLS update policy for members).
  let customerId = profile.agency.stripe_customer_id;
  if (!customerId) {
    customerId = await ensureCustomer({
      agencyId: profile.agency_id,
      agencyName: profile.agency.name,
      email: profile.email,
      existingCustomerId: null,
    });
    await admin.from("agencies").update({ stripe_customer_id: customerId }).eq("id", profile.agency_id);
  }

  // Quantity baseline = current live seats (at least 1).
  const supabase = await createClient();
  const { count } = await supabase
    .from("seats")
    .select("id", { count: "exact", head: true })
    .eq("status", "live");

  const url = await createCheckoutSession({
    customerId,
    agencyId: profile.agency_id,
    quantity: count ?? 0,
    successUrl: `${siteUrl()}/dashboard/billing?status=success`,
    cancelUrl: `${siteUrl()}/dashboard/billing?status=cancel`,
  });
  redirect(url);
}

/** Open the Stripe Customer Portal to manage payment / cancel. */
export async function openBillingPortal(): Promise<void> {
  const profile = await requireProfile();
  if (!isBillingEnabled() || !profile.agency.stripe_customer_id) return;

  const url = await createPortalSession({
    customerId: profile.agency.stripe_customer_id,
    returnUrl: `${siteUrl()}/dashboard/billing`,
  });
  redirect(url);
}
