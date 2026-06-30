"use client";

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
      <FormError message={state?.error} />
      <SubmitButton pending={pending} label="Sign in" />
    </form>
  );
}
