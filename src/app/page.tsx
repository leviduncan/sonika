import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";

const MARQUEE_ITEMS = [
  "MARKETING AGENCIES",
  "WEB DESIGN SHOPS",
  "FRACTIONAL CMOS",
  "CONSULTANTS",
  "INDIE SAAS",
  "RESELLERS",
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-grid radial-fade" aria-hidden />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/3 -z-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px] opacity-40"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 60%)" }}
      />

      <Header />
      <Hero />

      <section className="relative z-10 overflow-hidden border-y border-border py-6">
        <div className="flex w-max animate-marquee gap-16 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {Array.from({ length: 2 }).flatMap((_, j) =>
            MARQUEE_ITEMS.map((t, i) => (
              <span key={`${j}-${i}`} className="flex items-center gap-16">
                {t}
                <span className="text-accent">◆</span>
              </span>
            )),
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
