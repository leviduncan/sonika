import "server-only";
import { randomUUID } from "crypto";
import { isMockProvisioning } from "@/lib/services/mode";

/**
 * Twilio number provisioning. Searches for an available number and purchases
 * it; pairing it to the Vapi assistant happens in vapi.registerTwilioNumber.
 *
 * Real path runs when TWILIO_ACCOUNT_SID is set; otherwise mocked so local dev
 * needs no account and spends nothing.
 */

const TWILIO_BASE = "https://api.twilio.com/2010-04-01";
const COUNTRY = process.env.TWILIO_COUNTRY ?? "US";
const AREA_CODE = process.env.TWILIO_AREA_CODE; // optional

type ProvisionNumberResult = { number: string; phoneSid: string };

function mockNumber(): string {
  const last6 = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `+1555${last6.slice(0, 3)}${last6.slice(3)}`;
}

function authHeader(): string {
  // Prefer a scoped Twilio API Key (SK…) + secret. Fall back to the master
  // Account SID + Auth Token when no key is configured. Either way the Account
  // SID identifies the project in the URL path.
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  const user = keySid && keySecret ? keySid : process.env.TWILIO_ACCOUNT_SID;
  const pass = keySid && keySecret ? keySecret : process.env.TWILIO_AUTH_TOKEN;
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

async function twilioFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${TWILIO_BASE}/Accounts/${process.env.TWILIO_ACCOUNT_SID}${path}`, {
    ...init,
    headers: { Authorization: authHeader(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Twilio ${path} ${res.status}: ${body.slice(0, 300)}`);
  }
  // DELETE returns 204 with no body.
  return res.status === 204 ? null : res.json();
}

/** Search for, then purchase, a voice-capable number. */
export async function purchaseNumber(): Promise<ProvisionNumberResult> {
  if (isMockProvisioning() || !process.env.TWILIO_ACCOUNT_SID) {
    return { number: mockNumber(), phoneSid: `PNmock${randomUUID().replace(/-/g, "")}` };
  }

  const params = new URLSearchParams({ VoiceEnabled: "true", PageSize: "1" });
  if (AREA_CODE) params.set("AreaCode", AREA_CODE);
  const available = (await twilioFetch(
    `/AvailablePhoneNumbers/${COUNTRY}/Local.json?${params.toString()}`,
  )) as { available_phone_numbers: { phone_number: string }[] };

  const candidate = available.available_phone_numbers?.[0]?.phone_number;
  if (!candidate) throw new Error("No available Twilio numbers for the requested region.");

  const form = new URLSearchParams({ PhoneNumber: candidate });
  const purchased = (await twilioFetch("/IncomingPhoneNumbers.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })) as { sid: string; phone_number: string };

  return { number: purchased.phone_number, phoneSid: purchased.sid };
}

/** Best-effort release if a later provisioning step fails (avoid paying for an orphan). */
export async function releaseNumber(phoneSid: string): Promise<void> {
  if (isMockProvisioning() || !process.env.TWILIO_ACCOUNT_SID || phoneSid.startsWith("PNmock")) return;
  await twilioFetch(`/IncomingPhoneNumbers/${phoneSid}.json`, { method: "DELETE" });
}
