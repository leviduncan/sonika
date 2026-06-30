import type { ReactNode } from "react";
import Link from "next/link";
import { requireProfile } from "@/lib/dal";
import { logout } from "@/app/(auth)/actions";

// Auth is enforced here server-side (not just in the proxy), so every page
// under /dashboard is guaranteed a resolved profile.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur md:px-10">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent animate-pulse-dot" />
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {profile.agency.name}
          </span>
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="/dashboard/billing"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-accent"
          >
            Billing
          </Link>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            {profile.email} · {profile.role}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-accent"
            >
              Sign out ↗
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 md:px-10">{children}</main>
    </div>
  );
}
