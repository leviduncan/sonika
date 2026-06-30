import type { Metadata } from "next";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isBillingEnabled, isAgencyBilled } from "@/lib/services/stripe";
import { startCheckout, openBillingPortal } from "@/app/dashboard/billing/actions";

export const metadata: Metadata = { title: "Billing · Sonika" };

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "border-accent/60 text-accent text-glow" },
  trialing: { label: "Trialing", cls: "border-accent/60 text-accent" },
  past_due: { label: "Past due", cls: "border-yellow-500/40 text-yellow-400" },
  canceled: { label: "Canceled", cls: "border-border text-muted-foreground" },
  none: { label: "Not set up", cls: "border-border text-muted-foreground" },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await requireProfile();
  const { status: returnStatus } = await searchParams;

  const supabase = await createClient();
  const { count: liveSeats } = await supabase
    .from("seats")
    .select("id", { count: "exact", head: true })
    .eq("status", "live");

  const enabled = isBillingEnabled();
  const sub = profile.agency.subscription_status;
  const billed = isAgencyBilled(sub);
  const status = STATUS_LABEL[sub] ?? STATUS_LABEL.none;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-medium tracking-[-0.02em]">Billing</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        You pay per live voice agent. Each client whose agent is live counts as one seat.
      </p>

      {returnStatus === "success" && (
        <p className="mt-6 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 font-mono text-xs text-accent">
          ✓ Billing is set up. Your subscription will update as you provision agents.
        </p>
      )}
      {returnStatus === "cancel" && (
        <p className="mt-6 rounded-xl border border-border bg-muted/20 px-4 py-3 font-mono text-xs text-muted-foreground">
          Checkout canceled — no changes made.
        </p>
      )}

      {!enabled ? (
        <div className="mt-8 rounded-2xl border border-border bg-muted/20 p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Billing not configured
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground/80">
            Stripe isn&apos;t connected in this environment, so provisioning runs without billing.
            Set <span className="font-mono">STRIPE_SECRET_KEY</span> and{" "}
            <span className="font-mono">STRIPE_PRICE_ID</span> to enable it.
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-border bg-muted/20 p-8">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Subscription
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${status.cls}`}
            >
              {status.label}
            </span>
          </div>

          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-4xl font-medium">{liveSeats ?? 0}</span>
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
              live {liveSeats === 1 ? "seat" : "seats"}
            </span>
          </div>

          <div className="mt-8">
            {billed ? (
              <form action={openBillingPortal}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  Manage billing ↗
                </button>
              </form>
            ) : (
              <form action={startCheckout}>
                <button
                  type="submit"
                  className="glow-accent inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-accent-foreground transition-transform hover:-translate-y-0.5"
                >
                  Set up billing →
                </button>
              </form>
            )}
          </div>

          {!billed && (
            <p className="mt-4 font-mono text-[11px] text-muted-foreground/70">
              You&apos;ll need an active subscription before you can provision agents.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
