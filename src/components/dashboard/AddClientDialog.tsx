"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createSubAccount, type SubAccountState } from "@/app/dashboard/actions";
import { Field, TextareaField, FormError, SubmitButton } from "@/components/auth/fields";

export default function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SubAccountState, FormData>(
    createSubAccount,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Close + reset only when a submission actually succeeds. The effect runs on
  // new action results, not on `open`, so reopening after a success stays open.
  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glow-accent inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-accent-foreground transition-transform hover:-translate-y-0.5"
      >
        + Add client
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Add a client"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-muted/30 p-7 backdrop-blur">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl font-medium tracking-[-0.02em]">
                  Add a client
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create an end-client sub-account. Its voice agent comes next.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-sm text-muted-foreground transition-colors hover:text-accent"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form ref={formRef} action={action} className="mt-6 flex flex-col gap-4">
              <Field
                label="Client name"
                name="name"
                placeholder="Bayside Dental"
                autoComplete="off"
                required
                autoFocus
              />
              <Field
                label="Website URL"
                name="websiteUrl"
                placeholder="baysidedental.com"
                autoComplete="off"
                inputMode="url"
              />
              <TextareaField
                label="About this client"
                name="brief"
                rows={4}
                placeholder="Cosmetic + family dentist, open Mon–Fri 8–5. Always offer to book a consult; never quote prices — take a message instead."
                autoComplete="off"
                hint="Optional. Services, hours, how the agent should handle calls. We use this and their website to tailor the agent."
              />
              <FormError message={state?.error} />
              <SubmitButton pending={pending} label="Create client" />
            </form>
          </div>
        </div>
      )}
    </>
  );
}
