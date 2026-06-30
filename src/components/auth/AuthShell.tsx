import Link from "next/link";
import type { ReactNode } from "react";

/** Branded full-screen wrapper for auth pages — mirrors the landing look. */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16 text-foreground">
      <div className="absolute inset-0 bg-grid radial-fade" aria-hidden />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-0 h-[440px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px] opacity-30"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 60%)" }}
      />

      <Link
        href="/"
        className="relative z-10 mb-10 flex items-center gap-2.5"
        aria-label="Sonika home"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent animate-pulse-dot" />
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          sonika
        </span>
      </Link>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-muted/20 p-8 backdrop-blur">
        <h1 className="font-display text-2xl font-medium leading-tight tracking-[-0.02em]">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

        <div className="mt-8">{children}</div>
      </div>

      <div className="relative z-10 mt-6 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
        {footer}
      </div>
    </main>
  );
}
