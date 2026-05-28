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
  return (
    <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 pb-24 text-center md:pt-28">
      <div className="mb-10 inline-flex items-center gap-3 rounded-full border border-border bg-muted/30 px-4 py-1.5 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Building in public
        </span>
      </div>

      <h1 className="font-display text-[clamp(3rem,9vw,7.5rem)] font-medium leading-[0.95] tracking-[-0.04em]">
        sonika
      </h1>

      <div className="mt-8 flex items-center gap-4">
        <Waveform />
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-accent text-glow">
          live signal
        </span>
      </div>

      <p className="mt-10 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground md:text-xl">
        <span className="text-foreground">Voice infrastructure</span> for marketing agencies —
        purpose-built APIs, agents and pipelines that let your team ship voice products without the
        plumbing.
      </p>

      <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
        <a
          href="https://x.com/trysonika"
          target="_blank"
          rel="noreferrer"
          className="glow-accent group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-mono text-sm uppercase tracking-[0.15em] text-accent-foreground transition-transform hover:-translate-y-0.5"
        >
          Follow the build
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </a>
        <a
          href="mailto:hello@trysonika.com"
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
        >
          hello@trysonika.com
        </a>
      </div>
    </section>
  );
}
