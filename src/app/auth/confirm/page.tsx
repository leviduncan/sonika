import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import PendingSubmitButton from "@/components/auth/PendingSubmitButton";
import { confirmRecovery } from "@/app/(auth)/actions";
import { safeNext } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Continue · Sonika",
  // The URL carries a single-use token: keep it out of indexes and Referer headers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Landing point for the password-reset email. Deliberately does nothing on
 * GET: email security scanners open links to inspect them, and verifying
 * here would spend the single-use token before the user clicks. The token is
 * verified by the `confirmRecovery` Server Action when the user presses
 * Continue (works without JavaScript too).
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[]; type?: string | string[]; next?: string | string[] }>;
}) {
  const { token_hash: tokenHash, type, next } = await searchParams;

  if (typeof tokenHash !== "string" || !tokenHash || type !== "recovery") {
    redirect("/forgot-password?error=link_expired");
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Press continue to confirm it's you and choose a new password."
      footer={
        <Link href="/login" className="text-accent transition-colors hover:text-foreground">
          Back to sign in
        </Link>
      }
    >
      <form action={confirmRecovery} className="flex flex-col gap-4">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="next" value={safeNext(next)} />
        <PendingSubmitButton label="Continue" />
      </form>
    </AuthShell>
  );
}
