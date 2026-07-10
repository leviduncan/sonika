import Link from "next/link";
import type { Metadata } from "next";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isBillingEnforced, isAgencyBilled } from "@/lib/services/stripe";
import AddClientDialog from "@/components/dashboard/AddClientDialog";
import DeleteClientButton from "@/components/dashboard/DeleteClientButton";
import ProvisionButton from "@/components/dashboard/ProvisionButton";

export const metadata: Metadata = { title: "Dashboard · Sonika" };

// Provisioning (provisionClient) runs synchronously from this page: scrape →
// Claude → Vapi → Twilio → Vapi. Raise the Server Action timeout above the
// platform default so a slow site scrape + prompt generation never trips it.
// The scrape itself is separately bounded (SCRAPE_TIMEOUT_MS).
export const maxDuration = 60;

type Seat = {
  id: string;
  status: "pending" | "provisioning" | "live" | "failed" | "suspended";
  twilio_number: string | null;
};

type SubAccount = {
  id: string;
  name: string;
  website_url: string | null;
  status: "draft" | "provisioning" | "active" | "paused";
  created_at: string;
  seats: Seat[];
};

const STATUS_STYLES: Record<SubAccount["status"], string> = {
  draft: "border-border text-muted-foreground",
  provisioning: "border-accent/40 text-accent",
  active: "border-accent/60 text-accent text-glow",
  paused: "border-yellow-500/40 text-yellow-400",
};

function StatusBadge({ status }: { status: SubAccount["status"] }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function hostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function DashboardPage() {
  const profile = await requireProfile();

  // RLS scopes this to the caller's agency — no agency filter needed here.
  const supabase = await createClient();
  const { data } = await supabase
    .from("sub_accounts")
    .select("id, name, website_url, status, created_at, seats(id, status, twilio_number)")
    .order("created_at", { ascending: false });

  const subAccounts = (data ?? []) as SubAccount[];
  const firstName = profile.full_name?.split(" ")[0] ?? "there";
  const billingBlocked = isBillingEnforced() && !isAgencyBilled(profile.agency.subscription_status);

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
        {profile.agency.name}
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em]">
        Welcome, {firstName}.
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        This is your agency workspace. Your end-clients live here as sub-accounts — each one
        gets its own voice agent and number.
      </p>

      <section className="mt-10 rounded-2xl border border-border bg-muted/20 p-6 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Client sub-accounts
            <span className="ml-2 text-muted-foreground/60">{subAccounts.length}</span>
          </h2>
          <AddClientDialog />
        </div>

        {subAccounts.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="font-mono text-sm text-muted-foreground">No clients yet.</span>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground/70">
              Add your first end-client to get started. Paste their website and Sonika will
              provision the voice agent next.
            </p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col divide-y divide-border">
            {subAccounts.map((sa) => {
              const host = hostname(sa.website_url);
              const seat = sa.seats?.[0] ?? null;
              return (
                <li
                  key={sa.id}
                  className="flex items-center justify-between gap-4 py-4 first:pt-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/clients/${sa.id}`}
                        className="truncate font-display text-base font-medium transition-colors hover:text-accent"
                      >
                        {sa.name}
                      </Link>
                      <StatusBadge status={sa.status} />
                    </div>
                    {host ? (
                      <a
                        href={sa.website_url!}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-muted-foreground transition-colors hover:text-accent"
                      >
                        {host} ↗
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground/50">
                        no website
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-5">
                    {seat?.status === "live" ? (
                      <span className="flex items-center gap-2 font-mono text-xs text-accent">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
                        {seat.twilio_number ?? "live"}
                      </span>
                    ) : (
                      <ProvisionButton
                        subAccountId={sa.id}
                        hasWebsite={Boolean(sa.website_url)}
                        retry={seat?.status === "failed"}
                        billingBlocked={billingBlocked}
                      />
                    )}
                    <DeleteClientButton id={sa.id} name={sa.name} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
