import Link from "next/link";
import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in · Sonika" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your agency workspace."
      footer={
        <span>
          New here?{" "}
          <Link href="/signup" className="text-accent transition-colors hover:text-foreground">
            Create an agency
          </Link>
        </span>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
