"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signOutOtherDevices, updatePassword, type AuthState } from "@/app/(auth)/actions";
import { Field, FormError, FormNotice, SubmitButton } from "@/components/auth/fields";

export default function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, undefined);

  // The password changed but other sessions may still be live: say so, and
  // offer a retry instead of quietly moving on to the dashboard.
  if (state?.passwordUpdated) return <SignOutOthersRetry initialError={state.error} />;

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

function SignOutOthersRetry({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signOutOtherDevices, {
    passwordUpdated: true,
    error: initialError,
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormNotice message="Password updated." />
      <FormError message={state?.error} />
      <SubmitButton pending={pending} label="Sign out other devices" />
      <Link
        href="/dashboard"
        className="self-center font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-accent"
      >
        Skip for now and go to the dashboard
      </Link>
    </form>
  );
}
