import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import { isSignupOpen } from "@/lib/flags";

const MARQUEE_ITEMS = [
  "GOHIGHLEVEL AGENCIES",
  "LOCAL SEO AGENCIES",
  "WEB DESIGN AGENCIES",
  "LEAD GEN AGENCIES",
];

const ICP = [
  {
    name: "GoHighLevel agencies",
    line: "Add voice to the snapshots you already resell — no new stack to learn.",
  },
  {
    name: "Local SEO agencies",
    line: "Stop sending ranked clients calls they never pick up.",
  },
  {
    name: "Web design agencies",
    line: "Turn a one-off build into a monthly line item on every site you ship.",
  },
  {
    name: "Lead gen agencies",
    line: "Every lead answered in seconds, at any hour, on every account.",
  },
];

const WHY = [
  {
    metric: "< 10 min",
    title: "Client live the same call",
    line: "Paste their website URL. The agent writes itself, a number gets provisioned, and it answers. No scripting sessions, no telephony tickets.",
  },
  {
    metric: "Your margin",
    title: "You set the price",
    line: "You pay per seat and bill your client whatever you want. The spread is yours — it never shows up on their invoice.",
  },
  {
    metric: "100%",
    title: "White-label, end to end",
    line: "Your brand on the dashboard, your name on the relationship. Your clients never see a vendor behind you.",
  },
];

export default function Home() {
  const signupOpen = isSignupOpen();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-grid radial-fade" aria-hidden />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/3 -z-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px] opacity-40"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 60%)" }}
      />

      <Header />

      {/* 1. What it is */}
      <Hero />

      <section className="relative z-10 overflow-hidden border-y border-border py-6">
        <div className="flex w-max animate-marquee gap-16 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {Array.from({ length: 4 }).flatMap((_, j) =>
            MARQUEE_ITEMS.map((t, i) => (
              <span key={`${j}-${i}`} className="flex items-center gap-16">
                {t}
                <span className="text-accent">◆</span>
              </span>
            )),
          )}
        </div>
      </section>

      {/* 2. Who it's for */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
          Who it&apos;s for
        </p>
        <h2 className="mt-5 max-w-3xl text-balance font-display text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.1] tracking-[-0.03em]">
          Built for the agencies already selling to local businesses.
        </h2>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {ICP.map((seg) => (
            <li key={seg.name} className="bg-background/60 p-7 backdrop-blur">
              <h3 className="font-display text-lg font-medium tracking-[-0.01em]">{seg.name}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{seg.line}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Why it's better */}
      <section className="relative z-10 border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
            Why Sonika
          </p>
          <h2 className="mt-5 max-w-3xl text-balance font-display text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.1] tracking-[-0.03em]">
            Fast enough to sell on the call. Priced so you keep the upside.
          </h2>

          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {WHY.map((item) => (
              <div key={item.title}>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent text-glow">
                  {item.metric}
                </p>
                <h3 className="mt-4 font-display text-xl font-medium tracking-[-0.02em]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. What to do next */}
      <section
        id="early-access"
        className="relative z-10 scroll-mt-16 border-t border-border"
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-28 text-center">
          <div className="mb-9 inline-flex items-center gap-3 rounded-full border border-border bg-muted/30 px-4 py-1.5 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {signupOpen ? "Onboarding agencies now" : "Private alpha — early access open"}
            </span>
          </div>

          <h2 className="max-w-3xl text-balance font-display text-[clamp(2rem,5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
            Put your first client live this week.
          </h2>

          <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
            Bring one client&apos;s website URL. We&apos;ll have their voice agent answering a real
            phone number before the call ends.
          </p>

          <a
            href={signupOpen ? "/signup" : "mailto:hello@trysonika.com?subject=Sonika early access"}
            className="glow-accent group mt-11 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-mono text-sm uppercase tracking-[0.15em] text-accent-foreground transition-transform hover:-translate-y-0.5"
          >
            {signupOpen ? "Get started" : "Request early access"}
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </a>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {signupOpen ? (
              <>
                Already onboard?{" "}
                <a href="/login" className="transition-colors hover:text-foreground">
                  Log in ↗
                </a>
              </>
            ) : (
              "hello@trysonika.com"
            )}
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
