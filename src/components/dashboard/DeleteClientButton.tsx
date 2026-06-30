"use client";

import { deleteSubAccount } from "@/app/dashboard/actions";

/**
 * Binds the delete Server Action to a form, with a client-side confirm guard.
 * The action itself re-checks auth + relies on RLS, so the confirm is purely
 * UX, not the security boundary.
 */
export default function DeleteClientButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteSubAccount}
      onSubmit={(e) => {
        if (!confirm(`Remove ${name}? This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-red-400"
      >
        Remove
      </button>
    </form>
  );
}
