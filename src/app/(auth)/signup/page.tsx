import Link from "next/link";
import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Create your agency · Sonika" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Start your agency"
      subtitle="Spin up your Sonika workspace. You'll manage every end-client from one dashboard."
      footer={
        <span>
          Already onboard?{" "}
          <Link href="/login" className="text-accent transition-colors hover:text-foreground">
            Sign in
          </Link>
        </span>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
