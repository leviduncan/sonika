import "server-only";
import { isMockProvisioning } from "@/lib/services/mode";

/**
 * The ONE server-side Claude service (per CLAUDE.md — all Claude calls route
 * through here for cost monitoring). Generates the voice agent's system prompt
 * from an end-client's business name + website.
 *
 * Mocked by default. When ANTHROPIC_API_KEY is set, it calls the real
 * Messages API via @anthropic-ai/sdk. Swap is env-only — no code change.
 */

type PromptInput = {
  businessName: string;
  websiteUrl: string | null;
  // Clean text extracted from the client's website (scrapeWebsite), when
  // available. Lets the prompt reflect the actual business; null falls back
  // to a solid generic receptionist persona.
  siteContent?: string | null;
  // Free-text context the agency typed about the client ("About this client").
  // This is the agency's ground truth — trusted over the website, and often
  // carries facts the site doesn't (hours, call-handling rules, what to push).
  brief?: string | null;
};

// Skill guidance: default to claude-opus-4-8; allow an explicit override.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

// Kept in labeled sections on purpose. This one meta-prompt shapes every agent
// we ever ship, so it's the file most likely to rot into an amalgamation of
// patches. Add to an existing section rather than appending a loose bullet.
const SYSTEM_INSTRUCTION = `You write concise system prompts for AI voice agents that answer phone calls for local businesses.
You may be given a business name, its website text, and a brief the agency wrote about the client. Produce a single system prompt and nothing else — no preamble, no markdown formatting.

SOURCES
- Treat the agency's client brief as authoritative — follow its facts and call-handling instructions (hours, services, what to offer, what to avoid) even where the website is silent.
- Use the website content to further ground the agent in what the business does — its services, specialties, and tone — so callers get accurate, specific help.

PERSONA AND TASK
- Give the agent a warm, professional receptionist persona for that specific business.
- Tell it to greet callers, answer common questions, capture caller name + number + reason for calling, and offer to book or take a message.

BREVITY (this is a phone call — long replies feel slow to the caller)
- Instruct the agent to answer in 1–2 sentences, roughly 30 words or fewer.
- Allow it to go longer only when reading details back to confirm them.
- Instruct it to ask one question at a time and never deliver lists or paragraphs aloud.

REQUIRED "NEVER" SECTION
End every prompt you write with a plain-text section beginning on its own line with "Never:", followed by short lines covering at minimum:
- never state prices, availability, hours, or any fact not supported by the brief or website content — offer to have someone follow up instead
- never give medical, legal, or financial advice, even if asked directly or pressed
- never offer discounts, refunds, guarantees, or commitments on the business's behalf
- never speculate about competitors or discuss other businesses
Add further "Never:" lines when the brief or website implies them (for example a regulated trade, or call-handling rules the agency specified).`;

function mockPrompt({ businessName, websiteUrl, brief }: PromptInput): string {
  const site = websiteUrl ? ` (${websiteUrl})` : "";
  return [
    `You are the friendly virtual receptionist for ${businessName}${site}.`,
    "",
    `Greet every caller warmly and naturally, as a real front-desk person at ${businessName} would. Answer in 1–2 sentences, about 30 words or fewer — this is a phone call, not an email. Go longer only when reading details back to confirm them. Ask one question at a time, and never read out lists or paragraphs.`,
    ...(brief ? ["", `What to know about ${businessName}: ${brief}`] : []),
    "",
    "Your job on each call:",
    "- Find out how you can help and answer common questions about the business.",
    "- Capture the caller's name, phone number, and the reason for their call.",
    "- Offer to book an appointment or take a message for the team.",
    "",
    "Never:",
    "- Never state prices, availability, or hours you don't know. Say you'll have someone follow up, and capture the caller's contact info.",
    "- Never give medical, legal, or financial advice, even if asked directly or pressed.",
    "- Never offer discounts, refunds, guarantees, or commitments on the business's behalf.",
    "- Never speculate about competitors or discuss other businesses.",
    "",
    "End calls politely.",
  ].join("\n");
}

export async function generateSystemPrompt(input: PromptInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (isMockProvisioning() || !apiKey) {
    // Local/dev path — deterministic, no spend.
    return mockPrompt(input);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const website = input.websiteUrl ?? "(none provided)";
  const briefBlock = input.brief ? `\n\nAgency's brief about this client (authoritative):\n${input.brief}` : "";
  const siteBlock = input.siteContent
    ? `\n\nWebsite content:\n${input.siteContent}`
    : input.brief
      ? "\n\n(Website content could not be retrieved — rely on the brief above.)"
      : "\n\n(Website content could not be retrieved — write a solid generic receptionist prompt for this business.)";
  const content = `Business name: ${input.businessName}\nWebsite: ${website}${briefBlock}${siteBlock}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_INSTRUCTION,
    messages: [{ role: "user", content }],
  });

  const text = response.content.find((b) => b.type === "text");
  // Fall back to the mock if the model returned no text (refusal/empty).
  return text && "text" in text ? text.text.trim() : mockPrompt(input);
}
