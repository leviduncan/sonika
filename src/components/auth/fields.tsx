import type { InputHTMLAttributes } from "react";

const inputClass =
  "w-full rounded-xl border border-border bg-background/40 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60";

/** Labelled text input used across the auth forms. */
export function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {label}
      </label>
      <input id={name} name={name} className={inputClass} {...props} />
    </div>
  );
}

/** Primary submit button matching the accent CTA style. */
export function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="glow-accent group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-2.5 font-mono text-sm uppercase tracking-[0.15em] text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {pending ? "Working…" : (
        <>
          {label}
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </>
      )}
    </button>
  );
}

/** Inline form error line. */
export function FormError({ message }: { message?: string }) {
  return (
    <div className="min-h-[1.25rem] font-mono text-xs text-red-400" role="alert">
      {message}
    </div>
  );
}
