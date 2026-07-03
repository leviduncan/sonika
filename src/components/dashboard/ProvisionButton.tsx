"use client";

import Link from "next/link";
import { useActionState } from "react";
import { provisionClient, type ProvisionState } from "@/app/dashboard/actions";

/**
 * Per-row provisioning trigger. Binds the provisionClient action with the
 * sub-account id; shows pending + inline error. `retry` switches the label/
 * style for a previously-failed seat. `billingBlocked` gates it behind setting
 * up a subscription first.
 */
export default function ProvisionButton({
  subAccountId,
  hasWebsite,
  retry = false,
  billingBlocked = false,
}: {
  subAccountId: string;
  hasWebsite: boolean;
  retry?: boolean;
  billingBlocked?: boolean;
}) {
  const [state, action, pending] = useActionState<ProvisionState, FormData>(
    provisionClient,
    undefined,
  );

  if (!hasWebsite) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/50">
        add website to provision
      </span>
    );
  }

  if (billingBlocked) {
    return (
      <Link
        href="/dashboard/billing"
        className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-accent"
      >
        set up billing to provision →
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="subAccountId" value={subAccountId} />
        <button
          type="submit"
          disabled={pending}
          className={`rounded-xl border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors disabled:opacity-60 ${
            retry
              ? "border-yellow-500/40 text-yellow-400 hover:border-yellow-500/70"
              : "border-accent/50 text-accent hover:border-accent hover:glow-accent"
          }`}
        >
          {pending ? "Provisioning…" : retry ? "Retry" : "Provision agent"}
        </button>
      </form>
      {state?.error && (
        <span className="max-w-sm text-right font-mono text-[10px] leading-relaxed text-red-400">
          {state.error}
        </span>
      )}
    </div>
  );
}
