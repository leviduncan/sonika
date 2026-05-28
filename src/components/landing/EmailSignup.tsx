"use client";

import { useState, type FormEvent } from "react";

const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

type Status = "idle" | "submitting" | "success" | "error";

export default function EmailSignup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!WEBHOOK_URL) {
      setStatus("error");
      setErrorMessage("Signup is not configured. Please try again later.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          source: "trysonika.com",
          submittedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      setStatus("success");
      setName("");
      setEmail("");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage("Couldn't sign you up. Please try again.");
    }
  }

  return (
    <section className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center">
      <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-border bg-muted/30 px-4 py-1.5 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Private alpha — waitlist open
        </span>
      </div>

      <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-medium leading-[1] tracking-[-0.03em]">
        Get on the list.
      </h2>

      <p className="mt-5 mx-auto max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
        Be the first to ship voice products on Sonika. We'll only email when there's something worth
        opening.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 mx-auto flex w-full max-w-md flex-col gap-3">
        <label htmlFor="name" className="sr-only">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={status === "submitting"}
          placeholder="Your name"
          className="w-full rounded-full border border-border bg-muted/30 px-5 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 backdrop-blur transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "submitting"}
            placeholder="you@agency.com"
            className="flex-1 rounded-full border border-border bg-muted/30 px-5 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 backdrop-blur transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            className="glow-accent group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-mono text-sm uppercase tracking-[0.15em] text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {status === "submitting" ? (
              "Sending…"
            ) : (
              <>
                Notify me
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 min-h-[1.5rem] font-mono text-xs uppercase tracking-[0.2em]">
        {status === "success" && (
          <p className="text-accent text-glow">✓ You're on the list. Talk soon.</p>
        )}
        {status === "error" && <p className="text-muted-foreground">{errorMessage}</p>}
      </div>
    </section>
  );
}
