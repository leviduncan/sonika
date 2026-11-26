import Link from "next/link";
import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { getUser } from "@/lib/dal";
import { hasValidRecoveryCookie } from "@/lib/auth/recovery-cookie";

export const metadata: Metadata = { title: "Set a new password · Sonika" };

/**
 * Reached from the reset email via /auth/confirm, which signs the user in and
 * sets a 15-minute recovery cookie. A plain signed-in session isn't enough:
 * without the cookie the link was never opened here, already used, or expired.
 * (`updatePassword` re-checks the cookie; this only picks which screen to show.)
 */
export default async function ResetPasswordPage() {
  const sessionUser = await getUser();
  const user = sessionUser && (await hasValidRecoveryCookie(sessionUser.id)) ? sessionUser : null;

  const footer = (
    <Link href="/login" className="text-accent transition-colors hover:text-foreground">
      Back to sign in
    </Link>
  );

  if (!user) {
    return (
      <AuthShell
        title="Link expired"
        subtitle="This reset link is invalid or has already been used. Request a fresh one and we'll email it right over."
        footer={footer}
      >
        <Link
          href="/forgot-password"
          className="glow-accent inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-2.5 font-mono text-sm uppercase tracking-[0.15em] text-accent-foreground transition-transform hover:-translate-y-0.5"
        >
          Request a new link <span>→</span>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle={`For ${user.email}. You'll stay signed in here, and other devices will be signed out.`}
      footer={footer}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
