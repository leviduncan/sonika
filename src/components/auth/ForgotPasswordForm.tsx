"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "@/app/(auth)/actions";
import { Field, FormError, FormNotice, SubmitButton } from "@/components/auth/fields";

export default function ForgotPasswordForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    initialError ? { error: initialError } : undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* React resets the form after an action; defaultValue puts the email back. */}
      <Field
        label="Work email"
        name="email"
        type="email"
        placeholder="you@agency.com"
        autoComplete="email"
        defaultValue={state?.email}
        required
      />
      <FormNotice message={state?.message} />
      <FormError message={state?.error} />
      <SubmitButton pending={pending} label={state?.message ? "Send again" : "Send reset link"} />
    </form>
  );
}
