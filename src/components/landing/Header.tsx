import { isSignupOpen } from "@/lib/flags";

export default function Header() {
  const signupOpen = isSignupOpen();
  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent animate-pulse-dot" />
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {signupOpen ? "sonika / v0.1" : "sonika / v0.1 — parked"}
        </span>
      </div>
      {signupOpen ? (
        <a
          href="/login"
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-accent"
        >
          Log in ↗
        </a>
      ) : (
        <a
          href="https://x.com/trysonika"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-accent"
        >
          @trysonika ↗
        </a>
      )}
    </header>
  );
}
