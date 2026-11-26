"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/app/(auth)/actions";
import { Field, FormError, SubmitButton } from "@/components/auth/fields";

export default function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="New password"
        name="password"
        type="password"
        placeholder="At least 8 characters"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        placeholder="Type it again"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <FormError message={state?.error} />
      <SubmitButton pending={pending} label="Update password" />
    </form>
  );
}
