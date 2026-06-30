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

type PromptInput = { businessName: string; websiteUrl: string | null };

// Skill guidance: default to claude-opus-4-8; allow an explicit override.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

const SYSTEM_INSTRUCTION = `You write concise system prompts for AI voice agents that answer phone calls for local businesses.
Given a business name and website, produce a single system prompt (no preamble, no markdown) that:
- gives the agent a warm, professional receptionist persona for that specific business
- tells it to greet callers, answer common questions, capture caller name + number + reason for calling, and offer to book or take a message
- keeps replies short and natural for speech
- never invents prices, availability, or facts it doesn't know — offer a follow-up instead
Write only the prompt text.`;

function mockPrompt({ businessName, websiteUrl }: PromptInput): string {
  const site = websiteUrl ? ` (${websiteUrl})` : "";
  return [
    `You are the friendly virtual receptionist for ${businessName}${site}.`,
    "",
    `Greet every caller warmly and naturally, as a real front-desk person at ${businessName} would. Keep responses short and conversational — this is a phone call, not an email.`,
    "",
    "Your job on each call:",
    "- Find out how you can help and answer common questions about the business.",
    "- Capture the caller's name, phone number, and the reason for their call.",
    "- Offer to book an appointment or take a message for the team.",
    "",
    `Never invent prices, availability, or details you don't know. If you're unsure, say you'll have someone from ${businessName} follow up, and make sure you've captured the caller's contact info. End calls politely.`,
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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_INSTRUCTION,
    messages: [
      {
        role: "user",
        content: `Business name: ${input.businessName}\nWebsite: ${input.websiteUrl ?? "(none provided)"}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text");
  // Fall back to the mock if the model returned no text (refusal/empty).
  return text && "text" in text ? text.text.trim() : mockPrompt(input);
}
