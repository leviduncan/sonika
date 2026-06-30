import "server-only";
import { randomUUID } from "crypto";
import { isMockProvisioning } from "@/lib/services/mode";

/**
 * Vapi provisioning service. Creates the AI voice assistant and imports the
 * Twilio number so inbound calls reach it.
 *
 * Real path runs when VAPI_API_KEY is set; otherwise everything is mocked so
 * local dev needs no accounts. Swap is env-only.
 *
 * Voice agent config (model/voice/transcriber) has sensible defaults matching
 * Vapi's documented happy path; override via env if the account needs it.
 */

const VAPI_BASE = "https://api.vapi.ai";

const MODEL_PROVIDER = process.env.VAPI_MODEL_PROVIDER ?? "openai";
const MODEL = process.env.VAPI_MODEL ?? "gpt-4o";
const VOICE_PROVIDER = process.env.VAPI_VOICE_PROVIDER ?? "11labs";
const VOICE_ID = process.env.VAPI_VOICE_ID ?? "N2lVS1w4EtoT3dr4eOWO";

type CreateAssistantInput = { name: string; systemPrompt: string };
type CreateAssistantResult = { assistantId: string };

async function vapiFetch(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vapi ${path} ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

export async function createAssistant({
  name,
  systemPrompt,
}: CreateAssistantInput): Promise<CreateAssistantResult> {
  if (isMockProvisioning() || !process.env.VAPI_API_KEY) {
    return { assistantId: `mock_asst_${randomUUID()}` };
  }

  // Route end-of-call reports to our webhook when a public URL is configured.
  // Skipped locally (no public URL), where Vapi can't reach localhost anyway.
  const webhookUrl = process.env.VAPI_WEBHOOK_URL;
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
  const server = webhookUrl
    ? { url: webhookUrl, ...(webhookSecret ? { secret: webhookSecret } : {}) }
    : undefined;

  const data = (await vapiFetch("/assistant", {
    method: "POST",
    body: JSON.stringify({
      name: `Sonika — ${name}`,
      firstMessage: `Thanks for calling ${name}, how can I help you today?`,
      model: {
        provider: MODEL_PROVIDER,
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7,
      },
      voice: { provider: VOICE_PROVIDER, voiceId: VOICE_ID },
      transcriber: { provider: "deepgram", model: "nova-2", language: "en" },
      ...(server ? { server } : {}),
    }),
  })) as { id: string };

  return { assistantId: data.id };
}

type RegisterNumberInput = { assistantId: string; number: string };
type RegisterNumberResult = { vapiPhoneNumberId: string };

/** Import the Twilio number into Vapi and route it to the assistant. */
export async function registerTwilioNumber({
  assistantId,
  number,
}: RegisterNumberInput): Promise<RegisterNumberResult> {
  if (isMockProvisioning() || !process.env.VAPI_API_KEY) {
    return { vapiPhoneNumberId: `mock_pn_${randomUUID()}` };
  }

  // Field names confirmed against the live API: /phone-number/import expects
  // `twilioPhoneNumber` (E.164) and rejects `provider`/`number` (the docs are
  // stale on this). Auth prefers a scoped API Key (SK…) + secret; falls back to
  // the master Auth Token when no key is configured — Vapi accepts either.
  const useKey = Boolean(process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET);
  const data = (await vapiFetch("/phone-number/import", {
    method: "POST",
    body: JSON.stringify({
      twilioPhoneNumber: number,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      ...(useKey
        ? {
            twilioApiKeySid: process.env.TWILIO_API_KEY_SID,
            twilioApiKeySecret: process.env.TWILIO_API_KEY_SECRET,
          }
        : { twilioAuthToken: process.env.TWILIO_AUTH_TOKEN }),
      assistantId,
    }),
  })) as { id: string };

  return { vapiPhoneNumberId: data.id };
}

/** Best-effort teardown if a later provisioning step fails, or on client removal. */
export async function deleteAssistant(assistantId: string): Promise<void> {
  if (isMockProvisioning() || !process.env.VAPI_API_KEY || assistantId.startsWith("mock_")) return;
  await vapiFetch(`/assistant/${assistantId}`, { method: "DELETE" });
}

/** Delete the Vapi phone-number resource (after releasing the Twilio number). */
export async function deletePhoneNumber(vapiPhoneNumberId: string): Promise<void> {
  if (isMockProvisioning() || !process.env.VAPI_API_KEY || vapiPhoneNumberId.startsWith("mock_")) return;
  await vapiFetch(`/phone-number/${vapiPhoneNumberId}`, { method: "DELETE" });
}
