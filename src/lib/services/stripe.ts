import "server-only";
import Stripe from "stripe";
import { envFlag } from "./mode";

/**
 * Stripe per-seat billing service. One customer + one subscription per agency;
 * the subscription's single per-seat item carries quantity = live seat count.
 *
 * Env-gated: when STRIPE_SECRET_KEY is absent, billing is "not configured" —
 * the UI says so and provisioning enforcement is skipped, so local dev runs
 * without Stripe. STRIPE_PRICE_ID is the recurring per-seat price.
 */

/** Subscription statuses that count as "paying" — gate provisioning on these. */
export const BILLED_STATUSES = ["active", "trialing"] as const;

export function isBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Drop the provisioning paywall while keeping Stripe wired up. Lets you keep a
 * real STRIPE_SECRET_KEY in .env.local — so checkout, the portal, webhooks, and
 * seat-quantity sync all still work — but provision a client without first
 * subscribing. Mirrors PROVISIONING_MOCK. Set BILLING_MOCK=1 (or true/yes).
 */
export function isBillingMock(): boolean {
  return envFlag("BILLING_MOCK");
}

/**
 * Whether to actually gate provisioning on an active subscription. True only
 * when billing is configured AND not mocked. Use this for the paywall; use
 * isBillingEnabled() for "is Stripe wired up at all" (checkout, portal, sync).
 */
export function isBillingEnforced(): boolean {
  return isBillingEnabled() && !isBillingMock();
}

export function isAgencyBilled(status: string | null | undefined): boolean {
  return BILLED_STATUSES.includes((status ?? "") as (typeof BILLED_STATUSES)[number]);
}

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

/** Create a Stripe customer for the agency if it doesn't have one yet. */
export async function ensureCustomer(args: {
  agencyId: string;
  agencyName: string;
  email: string;
  existingCustomerId: string | null;
}): Promise<string> {
  if (args.existingCustomerId) return args.existingCustomerId;
  const customer = await getStripe().customers.create({
    name: args.agencyName,
    email: args.email,
    metadata: { agency_id: args.agencyId },
  });
  return customer.id;
}

/** Hosted Checkout to start the per-seat subscription. Returns the redirect URL. */
export async function createCheckoutSession(args: {
  customerId: string;
  agencyId: string;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: args.customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: Math.max(1, args.quantity) }],
    subscription_data: { metadata: { agency_id: args.agencyId } },
    allow_promotion_codes: true,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return session.url;
}

/** Customer Portal so the agency can manage payment method / cancel. */
export async function createPortalSession(args: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: args.customerId,
    return_url: args.returnUrl,
  });
  return session.url;
}

/** Set the per-seat subscription item quantity (kept at >= 1 baseline). */
export async function setSeatQuantity(subscriptionItemId: string, quantity: number): Promise<void> {
  await getStripe().subscriptionItems.update(subscriptionItemId, {
    quantity: Math.max(1, quantity),
    proration_behavior: "create_prorations",
  });
}

/** Fetch a subscription (to read status + item id from a webhook event). */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(subscriptionId);
}

/** Verify + parse an incoming Stripe webhook. Throws if the signature is bad. */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}
