import "server-only";
import { isMockProvisioning } from "@/lib/services/mode";

/**
 * Website content extraction for prompt generation. Given an end-client's URL,
 * fetches a clean text rendering of the page so Claude can tailor the voice
 * agent's prompt to the actual business (services, hours, tone) instead of
 * guessing from the name alone.
 *
 * Uses a hosted reader API (Jina Reader, https://r.jina.ai) which handles
 * JS-rendered pages and anti-bot far more reliably than a raw fetch + HTML
 * strip. Keyless by default; set JINA_API_KEY for higher rate limits.
 *
 * Best-effort by design: this NEVER throws. On timeout, a blocked site, or any
 * error it returns null, and generateSystemPrompt falls back to the name-only
 * prompt. Bounding the call this way keeps the synchronous provisioning chain
 * safely under the serverless function timeout — a slow site degrades the
 * prompt's specificity, it doesn't fail the provision.
 *
 * Skipped (returns null) in mock provisioning mode so local dev stays offline,
 * free, and deterministic, like the rest of the chain.
 */

const READER_BASE = "https://r.jina.ai/";

// Hard cap on how long we'll wait for the reader before giving up and
// provisioning with the name-only prompt. Kept well under the route's
// maxDuration so the rest of the chain always has room to finish.
const TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS ?? 8000);

// Bound the text handed to Claude — a homepage's first several thousand chars
// carry the business identity; the rest is nav/footer noise and just burns tokens.
const MAX_CHARS = Number(process.env.SCRAPE_MAX_CHARS ?? 6000);

/** Fetch a clean text rendering of the site, or null if unavailable. */
export async function scrapeWebsite(url: string): Promise<string | null> {
  if (isMockProvisioning()) return null;

  const apiKey = process.env.JINA_API_KEY;
  try {
    const res = await fetch(`${READER_BASE}${url}`, {
      headers: {
        Accept: "text/plain",
        // Ask the reader for markdown; keeps headings/lists that signal structure.
        "X-Return-Format": "markdown",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`scrapeWebsite ${url} → ${res.status}; using name-only prompt`);
      return null;
    }
    const text = (await res.text()).trim();
    if (!text) return null;
    return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;
  } catch (err) {
    // Timeout (AbortError) or network failure — degrade, don't fail.
    console.warn(`scrapeWebsite ${url} failed; using name-only prompt`, err);
    return null;
  }
}
