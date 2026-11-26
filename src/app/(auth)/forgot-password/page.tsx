import Link from "next/link";
import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password · Sonika" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError =
    error === "link_expired"
      ? "That reset link is invalid or has expired. Request a new one below."
      : undefined;

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you sign in with and we'll send you a link to set a new password."
      footer={
        <span>
          Remembered it?{" "}
          <Link href="/login" className="text-accent transition-colors hover:text-foreground">
            Sign in
          </Link>
        </span>
      }
    >
      <ForgotPasswordForm initialError={initialError} />
    </AuthShell>
  );
}
