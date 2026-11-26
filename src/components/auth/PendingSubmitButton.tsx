"use client";

import { useFormStatus } from "react-dom";
import { SubmitButton } from "@/components/auth/fields";

/**
 * SubmitButton for plain `<form action={serverAction}>` forms (no
 * useActionState). Disables itself while the form is submitting, so a
 * double-click can't send a single-use token twice.
 */
export default function PendingSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending} label={label} />;
}
