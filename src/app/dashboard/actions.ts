"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/dal";
import { generateSystemPrompt } from "@/lib/services/claude";
import {
  createAssistant,
  registerTwilioNumber,
  deleteAssistant,
  deletePhoneNumber,
} from "@/lib/services/vapi";
import { purchaseNumber, releaseNumber } from "@/lib/services/twilio";
import { isBillingEnabled, isBillingEnforced, isAgencyBilled, setSeatQuantity } from "@/lib/services/stripe";
import type { AgencyProfile } from "@/lib/dal";

export type SubAccountState = { error?: string; ok?: boolean } | undefined;

/**
 * Push the agency's live-seat count to Stripe as the subscription quantity.
 * No-op unless billing is enabled and the agency has a subscription item.
 */
async function syncSeatBilling(profile: AgencyProfile): Promise<void> {
  const itemId = profile.agency.stripe_subscription_item_id;
  if (!isBillingEnabled() || !itemId) return;
  const admin = createAdminClient();
  const { count } = await admin
    .from("seats")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", profile.agency_id)
    .eq("status", "live");
  await setSeatQuantity(itemId, count ?? 0).catch((e) =>
    console.error("seat quantity sync failed", e),
  );
}

const CreateSchema = z.object({
  name: z.string().trim().min(2, "Client name must be at least 2 characters."),
  websiteUrl: z.string().trim().optional(),
});

/**
 * Normalize a user-typed website into a canonical URL, or null if blank.
 * Accepts bare domains ("acme.com") by assuming https. Returns false on
 * something that isn't a plausible URL so the caller can show an error.
 */
function normalizeWebsite(raw?: string): string | null | false {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".")) return false;
    return url.toString();
  } catch {
    return false;
  }
}

export async function createSubAccount(
  _prev: SubAccountState,
  formData: FormData,
): Promise<SubAccountState> {
  // Auth is verified inside the action — Server Actions are reachable by
  // direct POST, not just through our UI.
  const profile = await requireProfile();

  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    websiteUrl: formData.get("websiteUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const website = normalizeWebsite(parsed.data.websiteUrl);
  if (website === false) {
    return { error: "That website URL doesn't look valid." };
  }

  const supabase = await createClient();
  // agency_id is stamped explicitly; RLS `with check` then confirms it
  // matches the caller's agency, so a forged id can't cross tenants.
  const { error } = await supabase.from("sub_accounts").insert({
    agency_id: profile.agency_id,
    name: parsed.data.name,
    website_url: website,
    status: "draft",
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export type ProvisionState = { error?: string; ok?: boolean } | undefined;

/**
 * Provision a sub-account's voice agent: generate the system prompt (Claude),
 * create the Vapi assistant, assign a Twilio number, and flip the seat live.
 *
 * Authorization comes from the RLS read of the sub-account (only the owner's
 * agency can see it). Provisioning writes then run via the service-role client
 * per architecture.md, with agency_id stamped from the verified profile. Any
 * step failing leaves the seat `failed` (retryable) and the sub-account `draft`.
 */
export async function provisionClient(
  _prev: ProvisionState,
  formData: FormData,
): Promise<ProvisionState> {
  const profile = await requireProfile();
  const subAccountId = String(formData.get("subAccountId") ?? "");
  if (!subAccountId) return { error: "Missing client." };

  // RLS read = authorization: returns the row only if it's this agency's.
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("sub_accounts")
    .select("id, name, website_url")
    .eq("id", subAccountId)
    .single();

  if (!sub) return { error: "Client not found." };
  if (!sub.website_url) {
    return { error: "Add a website to this client before provisioning." };
  }

  // Margin guard: a live seat costs Sonika real Vapi+Twilio money, so an agency
  // must have an active subscription first. Skipped when billing isn't enabled
  // or BILLING_MOCK is set (dev: keep Stripe wired up but drop the paywall).
  if (isBillingEnforced() && !isAgencyBilled(profile.agency.subscription_status)) {
    return { error: "Set up billing before provisioning agents." };
  }

  const admin = createAdminClient();

  // Find the existing seat (1:1 for MVP). Don't re-provision a live one;
  // reuse a failed/pending seat so this doubles as retry.
  const { data: existingSeat } = await admin
    .from("seats")
    .select("id, status")
    .eq("sub_account_id", subAccountId)
    .maybeSingle();

  if (existingSeat?.status === "live") {
    return { error: "This client's agent is already live." };
  }

  // Mark provisioning.
  await admin.from("sub_accounts").update({ status: "provisioning" }).eq("id", subAccountId);

  let seatId = existingSeat?.id as string | undefined;
  if (seatId) {
    await admin.from("seats").update({ status: "provisioning" }).eq("id", seatId);
  } else {
    const { data: newSeat, error: seatErr } = await admin
      .from("seats")
      .insert({
        agency_id: profile.agency_id,
        sub_account_id: subAccountId,
        status: "provisioning",
      })
      .select("id")
      .single();
    if (seatErr || !newSeat) {
      await admin.from("sub_accounts").update({ status: "draft" }).eq("id", subAccountId);
      return { error: "Couldn't start provisioning." };
    }
    seatId = newSeat.id;
  }

  // Track resources we create so a partial failure can be torn down rather
  // than left orphaned (and, for Twilio numbers, billed).
  let assistantId: string | undefined;
  let purchasedSid: string | undefined;
  try {
    const systemPrompt = await generateSystemPrompt({
      businessName: sub.name,
      websiteUrl: sub.website_url,
    });

    // 1. Vapi assistant  2. Twilio number  3. point the number at the assistant
    ({ assistantId } = await createAssistant({ name: sub.name, systemPrompt }));
    const { number, phoneSid } = await purchaseNumber();
    purchasedSid = phoneSid;
    const { vapiPhoneNumberId } = await registerTwilioNumber({ assistantId, number });

    await admin
      .from("seats")
      .update({
        vapi_assistant_id: assistantId,
        vapi_phone_number_id: vapiPhoneNumberId,
        twilio_number: number,
        twilio_phone_sid: phoneSid,
        system_prompt: systemPrompt,
        status: "live",
      })
      .eq("id", seatId);
    await admin.from("sub_accounts").update({ status: "active" }).eq("id", subAccountId);

    await syncSeatBilling(profile); // bump Stripe quantity to the new live count
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    // Best-effort teardown of anything we provisioned before the failure.
    console.error("Provisioning failed for sub_account", subAccountId, err);
    if (purchasedSid) await releaseNumber(purchasedSid).catch(() => {});
    if (assistantId) await deleteAssistant(assistantId).catch(() => {});

    // Leave a failed seat so the UI can offer a retry (architecture.md §5).
    await admin.from("seats").update({ status: "failed" }).eq("id", seatId);
    await admin.from("sub_accounts").update({ status: "draft" }).eq("id", subAccountId);
    return { error: "Provisioning failed. You can retry." };
  }
}

export async function deleteSubAccount(formData: FormData): Promise<void> {
  const profile = await requireProfile();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();

  // De-provision external resources BEFORE deleting the rows — otherwise the
  // seat (which holds the provider ids) cascades away and we lose the handles,
  // leaving a paid Twilio number live and a Vapi assistant orphaned. The RLS
  // read returns the seat only if it belongs to the caller's agency. Teardown
  // helpers no-op in mock mode / for mock ids, so this is safe in dev.
  const { data: seat } = await supabase
    .from("seats")
    .select("twilio_phone_sid, vapi_phone_number_id, vapi_assistant_id")
    .eq("sub_account_id", id)
    .maybeSingle();

  if (seat) {
    if (seat.twilio_phone_sid) await releaseNumber(seat.twilio_phone_sid).catch(() => {});
    if (seat.vapi_phone_number_id) await deletePhoneNumber(seat.vapi_phone_number_id).catch(() => {});
    if (seat.vapi_assistant_id) await deleteAssistant(seat.vapi_assistant_id).catch(() => {});
  }

  // No agency filter needed: RLS scopes the delete to the caller's agency, so
  // this can only ever remove one of their own sub-accounts (seat cascades).
  await supabase.from("sub_accounts").delete().eq("id", id);

  await syncSeatBilling(profile); // drop Stripe quantity to the new live count
  revalidatePath("/dashboard");
}
