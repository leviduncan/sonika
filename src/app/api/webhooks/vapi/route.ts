import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vapi server webhook. Receives end-of-call reports and writes them to
 * call_logs. Runs with the service-role client (bypasses RLS) and maps the
 * call back to a seat via the assistant id, stamping agency_id/sub_account_id
 * so the row is tenant-scoped for readers.
 *
 * Auth: Vapi sends the configured server secret in the `X-Vapi-Secret` header.
 * We enforce it whenever VAPI_WEBHOOK_SECRET is set. Inserts are idempotent on
 * vapi_call_id, since Vapi may retry.
 */

type VapiCall = {
  id?: string;
  assistantId?: string;
  phoneNumberId?: string;
  customer?: { number?: string };
};

type VapiMessage = {
  type?: string;
  endedReason?: string;
  startedAt?: string;
  endedAt?: string;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  transcript?: string;
  summary?: string;
  call?: VapiCall;
  assistant?: { id?: string };
  analysis?: { summary?: string };
  artifact?: { transcript?: string; recording?: { url?: string; stereoUrl?: string } };
};

export async function POST(req: NextRequest) {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (expected && req.headers.get("x-vapi-secret") !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: { message?: VapiMessage };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const message = body.message;
  // We only persist end-of-call reports; acknowledge everything else so Vapi
  // doesn't retry.
  if (message?.type !== "end-of-call-report") {
    return NextResponse.json({ ok: true, ignored: message?.type ?? "unknown" });
  }

  const call = message.call ?? {};
  const assistantId = call.assistantId ?? message.assistant?.id ?? null;
  const phoneNumberId = call.phoneNumberId ?? null;

  const admin = createAdminClient();

  // Map the call to a seat (and thus agency/sub-account). Prefer the assistant
  // id; fall back to the Vapi phone-number id.
  let seat: { id: string; agency_id: string; sub_account_id: string } | null = null;
  if (assistantId) {
    const { data } = await admin
      .from("seats")
      .select("id, agency_id, sub_account_id")
      .eq("vapi_assistant_id", assistantId)
      .maybeSingle();
    seat = data;
  }
  if (!seat && phoneNumberId) {
    const { data } = await admin
      .from("seats")
      .select("id, agency_id, sub_account_id")
      .eq("vapi_phone_number_id", phoneNumberId)
      .maybeSingle();
    seat = data;
  }
  if (!seat) {
    // Unknown assistant/number — ack so Vapi stops retrying, but don't store.
    return NextResponse.json({ ok: true, unmatched: true });
  }

  const startedAt = message.startedAt ?? null;
  const endedAt = message.endedAt ?? null;
  const durationSeconds =
    startedAt && endedAt
      ? Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000))
      : null;

  const row = {
    agency_id: seat.agency_id,
    seat_id: seat.id,
    sub_account_id: seat.sub_account_id,
    vapi_call_id: call.id ?? null,
    caller_number: call.customer?.number ?? null,
    duration_seconds: durationSeconds,
    recording_url:
      message.artifact?.recording?.stereoUrl ??
      message.artifact?.recording?.url ??
      message.recordingUrl ??
      message.stereoRecordingUrl ??
      null,
    transcript: message.artifact?.transcript ?? message.transcript ?? null,
    summary: message.analysis?.summary ?? message.summary ?? null,
    ended_reason: message.endedReason ?? null,
    started_at: startedAt,
  };

  const { error } = call.id
    ? await admin.from("call_logs").upsert(row, { onConflict: "vapi_call_id" })
    : await admin.from("call_logs").insert(row);

  if (error) {
    console.error("call_logs write failed:", error);
    return new NextResponse("Insert failed", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
