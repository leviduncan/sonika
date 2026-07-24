import { isSignupOpen } from "@/lib/flags";

function Waveform() {
  const bars = [0.4, 0.7, 0.9, 0.55, 1, 0.75, 0.45, 0.85, 0.6, 0.95, 0.5, 0.8, 0.35, 0.7, 0.9];
  return (
    <div className="flex items-center gap-[3px] h-10">
      {bars.map((h, i) => (
        <span
          key={i}
          className="bar w-[3px] rounded-full bg-accent"
          style={{
            height: `${h * 100}%`,
            animationDelay: `${i * 0.07}s`,
            opacity: 0.5 + h * 0.5,
          }}
        />
      ))}
    </div>
  );
}

export default function Hero() {
  const signupOpen = isSignupOpen();
  return (
    <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 pb-24 text-center md:pt-28">
      <div className="mb-10 inline-flex items-center gap-3 rounded-full border border-border bg-muted/30 px-4 py-1.5 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Building in public
        </span>
      </div>

      <div className="flex items-center gap-5">
        <span className="font-display text-[clamp(2rem,5vw,3.25rem)] font-medium leading-none tracking-[-0.04em]">
          sonika
        </span>
        <Waveform />
        <span className="hidden font-mono text-xs uppercase tracking-[0.25em] text-accent text-glow sm:inline">
          live signal
        </span>
      </div>

      <h1 className="mt-10 max-w-4xl text-balance font-display text-[clamp(2.5rem,7vw,5rem)] font-medium leading-[1.02] tracking-[-0.035em]">
        Launch AI voice agents for every client in{" "}
        <span className="text-accent text-glow">under 10 minutes</span>.
      </h1>

      <p className="mt-7 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground md:text-xl">
        <span className="text-foreground">White-label Voice AI</span> built specifically for
        agencies.
      </p>

      <p className="mt-4 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground">
        No scripting. No dev work. No telephony setup.
      </p>

      <p className="mt-6 max-w-2xl font-mono text-[11px] uppercase leading-relaxed tracking-[0.2em] text-muted-foreground">
        GoHighLevel · Local SEO · Web Design · Lead Gen agencies
      </p>

      <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
        {signupOpen ? (
          <>
            <a
              href="/signup"
              className="glow-accent group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-mono text-sm uppercase tracking-[0.15em] text-accent-foreground transition-transform hover:-translate-y-0.5"
            >
              Get started
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href="/login"
              className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Log in
            </a>
          </>
        ) : (
          <>
            <a
              href="#early-access"
              className="glow-accent group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-mono text-sm uppercase tracking-[0.15em] text-accent-foreground transition-transform hover:-translate-y-0.5"
            >
              Get early access
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href="https://x.com/trysonika"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Follow the build ↗
            </a>
          </>
        )}
      </div>
    </section>
  );
}
