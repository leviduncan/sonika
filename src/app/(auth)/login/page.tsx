import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in · Sonika" };

export default async function LoginPage() {
  // Render per request, never prerender. A Server Action that redirects here
  // (sign out, a lost session) copies this page's headers onto a response that
  // can carry session cookies, and a prerendered page says `s-maxage=31536000`.
  await connection();

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
