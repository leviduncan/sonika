import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client · Sonika" };

type Seat = { status: string; twilio_number: string | null };
type SubAccount = {
  id: string;
  name: string;
  website_url: string | null;
  status: string;
  seats: Seat[];
};
type CallLog = {
  id: string;
  caller_number: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  ended_reason: string | null;
  started_at: string | null;
  created_at: string;
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function fmtDuration(s: number | null): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default async function ClientCallsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();

  const supabase = await createClient();
  // RLS scopes both reads to the caller's agency.
  const { data: sub } = await supabase
    .from("sub_accounts")
    .select("id, name, website_url, status, seats(status, twilio_number)")
    .eq("id", id)
    .maybeSingle();

  if (!sub) notFound();
  const client = sub as SubAccount;
  const seat = client.seats?.[0] ?? null;

  const { data: callsData } = await supabase
    .from("call_logs")
    .select(
      "id, caller_number, duration_seconds, recording_url, transcript, summary, ended_reason, started_at, created_at",
    )
    .eq("sub_account_id", id)
    .order("started_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  const calls = (callsData ?? []) as CallLog[];

  return (
    <div>
      <Link
        href="/dashboard"
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-accent"
      >
        ← All clients
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-[-0.02em]">{client.name}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {client.website_url ?? "no website"}
          </p>
        </div>
        {seat?.status === "live" && seat.twilio_number ? (
          <span className="flex items-center gap-2 font-mono text-xs text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
            {seat.twilio_number}
          </span>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60">
            agent not live
          </span>
        )}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Call log
            <span className="ml-2 text-muted-foreground/60">{calls.length}</span>
          </h2>
        </div>

        {calls.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-muted/20 p-10 text-center">
            <p className="font-mono text-sm text-muted-foreground">No calls yet.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground/70">
              Calls answered by this client&apos;s agent will appear here — caller, duration,
              summary, transcript, and recording.
            </p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {calls.map((c) => (
              <li key={c.id} className="rounded-2xl border border-border bg-muted/20 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-display text-base font-medium">
                    {c.caller_number ?? "Unknown caller"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {fmtDateTime(c.started_at ?? c.created_at)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>{fmtDuration(c.duration_seconds)}</span>
                  {c.ended_reason && (
                    <span className="rounded-full border border-border px-2 py-0.5">
                      {c.ended_reason}
                    </span>
                  )}
                  {c.recording_url && (
                    <a
                      href={c.recording_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent transition-colors hover:text-foreground"
                    >
                      ▶ recording
                    </a>
                  )}
                </div>

                {c.summary && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.summary}</p>
                )}

                {c.transcript && (
                  <details className="mt-3 group">
                    <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-accent">
                      Transcript
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground/80">
                      {c.transcript}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
