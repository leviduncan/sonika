"use client";

import { useFormStatus } from "react-dom";
import { SubmitButton } from "@/components/auth/fields";

/** Submit button for a `<form action={logout}>`. */
export default function SignOutButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending} label="Sign out" />;
}
