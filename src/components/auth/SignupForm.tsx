"use client";

import { useActionState } from "react";
import { signup, type AuthState } from "@/app/(auth)/actions";
import { Field, FormError, SubmitButton } from "@/components/auth/fields";

export default function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Agency name"
        name="agencyName"
        placeholder="Acme Marketing"
        autoComplete="organization"
        required
      />
      <Field
        label="Your name"
        name="fullName"
        placeholder="Jordan Rivera"
        autoComplete="name"
        required
      />
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
        placeholder="At least 8 characters"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <FormError message={state?.error} />
      <SubmitButton pending={pending} label="Create agency" />
    </form>
  );
}
