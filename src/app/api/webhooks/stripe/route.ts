import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent, getSubscription } from "@/lib/services/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook. Keeps each agency's subscription state in sync (status +
 * item id) so provisioning enforcement and the billing page read from our DB,
 * not Stripe, on every request. Verifies the signature; writes via service role.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing signature", { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return new NextResponse("Bad signature", { status: 400 });
  }

  const admin = createAdminClient();

  async function syncAgency(sub: Stripe.Subscription) {
    const agencyId = (sub.metadata?.agency_id as string | undefined) ?? null;
    const patch = {
      stripe_subscription_id: sub.id,
      stripe_subscription_item_id: sub.items?.data?.[0]?.id ?? null,
      subscription_status: sub.status,
    };
    // Prefer the agency_id we stamped in metadata; fall back to the customer id.
    if (agencyId) {
      await admin.from("agencies").update(patch).eq("id", agencyId);
    } else {
      await admin.from("agencies").update(patch).eq("stripe_customer_id", String(sub.customer));
    }
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncAgency(event.data.object as Stripe.Subscription);
      break;
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        await syncAgency(await getSubscription(String(session.subscription)));
      }
      break;
    }
    default:
      break; // ignore everything else
  }

  return NextResponse.json({ received: true });
}
