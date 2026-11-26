"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthState } from "@/app/(auth)/actions";
import { Field, FormError, SubmitButton } from "@/components/auth/fields";

export default function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Work email"
        name="email"
        type="email"
        placeholder="you@agency.com"
        autoComplete="email"
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        placeholder="Your password"
        autoComplete="current-password"
        required
      />
      <Link
        href="/forgot-password"
        className="-mt-2 self-end font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-accent"
      >
        Forgot password?
      </Link>
      <FormError message={state?.error} />
      <SubmitButton pending={pending} label="Sign in" />
    </form>
  );
}
