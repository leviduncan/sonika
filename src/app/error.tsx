"use client";

import { logout } from "@/app/(auth)/actions";
import AuthShell from "@/components/auth/AuthShell";
import SignOutButton from "@/components/auth/SignOutButton";

/**
 * Shown when a page or Server Action throws. The copy is deliberately generic:
 * the error's message, stack and digest are never rendered. Sign out is the way
 * out when retrying keeps failing.
 */
export default function ErrorPage({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <AuthShell
      title="Something went wrong"
      subtitle="We couldn't load this page. Try again in a moment."
      footer={null}
    >
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex w-full items-center justify-center rounded-xl border border-border px-6 py-2.5 font-mono text-sm uppercase tracking-[0.15em] text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          Try again
        </button>
        <form action={logout}>
          <SignOutButton />
        </form>
      </div>
    </AuthShell>
  );
}
