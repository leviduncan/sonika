export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-6 py-10 md:flex-row md:items-center md:px-0">
      <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        © {year} Sonika — All signals reserved
      </div>
      <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        <a
          href="https://x.com/trysonika"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-accent"
        >
          x.com/trysonika
        </a>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
          System nominal
        </span>
      </div>
    </footer>
  );
}
