# Sonika — Project Status & Go-Live Guide

_Last updated: 2026-07-09_

This is a standalone status snapshot written to be readable without repo access
(safe to paste into Claude Chat). It covers what Sonika is, what's built and
verified, what remains, and the exact steps to take it live.

> ## 🟢 STATUS: LIVE — REAL VOICE AGENTS WORKING END-TO-END
> Sonika is deployed at **https://trysonika.com** and the **full product loop
> works in production with real money/services**: an agency signs up → adds a
> client → Sonika generates the prompt (Claude), creates the voice agent
> (Vapi, "Clara" voice), buys a real phone number (Twilio), and goes live.
> A real client ("Bayside Plumbing", `+1 478 412 4023`) has taken **real
> inbound calls**, each auto-logged with an AI **summary, transcript, and
> recording**. **Steps 1–5 of the go-live checklist are done.**
> Remaining: verify/finish **Stripe billing** (Step 6), decide when to **open
> public signups** (Step 4), and **A2P 10DLC** if/when SMS is added (Step 8).
> The public landing page is still **parked** (signup by direct URL only) by choice.

---

## 1. What Sonika is

**Voice infrastructure for marketing agencies.** A white-label B2B2B SaaS.
Agencies sign up, create sub-accounts for their end-clients, paste a client's
website URL, and Sonika auto-generates an AI voice agent, provisions a phone
number, and deploys a working AI receptionist in minutes. Agencies manage
everything from one dashboard and resell to clients at their own margin.

- **Buyer:** marketing agencies, web shops, fractional CMOs, consultants (1–20 people). NOT the end-customer.
- **Positioning:** "voice infrastructure for marketing agencies" — never "AI receptionist," never selling the underlying tech.

### Stack
| Layer | Tech |
|---|---|
| App | Next.js 16 (App Router) + TypeScript + Tailwind |
| Hosting | Vercel |
| Auth + DB | Supabase (Postgres + Row-Level Security, multi-tenant) |
| Voice agents | Vapi (via API) |
| Phone numbers | Twilio |
| Billing | Stripe (per-seat subscription) |
| Email | Resend |
| AI prompt generation | Claude API |

---

## 2. Where we are right now

**The full MVP is committed, pushed, deployed, and verified working in production.**
The app is live at **https://trysonika.com** on Vercel, backed by a production
Supabase project (`sonika-os-db`). Before this work, only the marketing landing
page was in the repo; the entire app (~3,600 lines) was sitting uncommitted on the
local machine. It's now version-controlled, reviewed, and running live.

### Proven working in production (verified 2026-07-03)
- ✅ **Vercel deploy** connected to the GitHub repo; pushes to `main` auto-deploy.
- ✅ **Landing page** renders at trysonika.com (currently in parked/teaser mode by design).
- ✅ **Prod Supabase** connected with valid keys; the 3 migrations are applied (all 5 tables exist).
- ✅ **Signup works end-to-end** — a real account ("Levi Marketing") signed up, the DB trigger auto-created the agency + owner profile, the auth session held, and the dashboard rendered its RLS-scoped client list.
- ✅ **Real provisioning works end-to-end** — added a client ("Bayside Plumbing"), and Sonika generated the prompt (Claude), created the Vapi assistant with the **Clara** voice, **bought a real Twilio number** (`+1 478 412 4023`), and imported it into Vapi. Seat went **live**.
- ✅ **Real inbound calls log correctly** — live callers reached the agent; each call auto-appeared in the dashboard with an AI **summary**, **transcript**, caller number, duration, ended-reason, and **recording** link.
- ✅ **Live call auto-refresh** — the client call-log page polls while the agent is live, so calls appear without a manual reload (great for demos).
- ✅ **Provisioning errors surface in the UI** — a failed provision now shows the underlying Vapi/Twilio/Claude error on the dashboard, not a generic message.

### What's built and in the repo
- **Multi-tenant database schema** — agencies, profiles, sub-accounts (end-clients), seats (one provisioned voice agent = the billing unit), call logs. Tenant isolation enforced by Postgres Row-Level Security keyed on `agency_id`.
- **Agency authentication** — signup, login, logout. New signups auto-create an agency + owner profile via a database trigger.
- **Agency dashboard** — create and manage end-client sub-accounts, view call logs per client.
- **Provisioning flow** — add a client (name + website + optional **"About this client" brief**) → **Sonika reads the site** (Jina Reader) → Claude generates a system prompt tailored to that business, treating the agency's brief as authoritative → Vapi assistant created → Twilio number purchased and attached → agent goes live. The website read is best-effort and time-bounded: a slow or blocked site falls back to the brief (or a generic prompt) rather than failing the provision. The brief is what keeps a demo agent specific even when the client's site is thin. Includes automatic teardown if any step fails (so a crash never leaves a paid phone number or orphaned assistant behind).
- **Stripe per-seat billing** — checkout, customer portal, webhook sync, automatic seat-quantity updates, and a paywall that requires an active subscription before provisioning (with a dev bypass).
- **Vapi call webhook** — receives end-of-call reports and writes them to call logs, signature-verified.
- **Signup gate flag** — the public landing page stays a "parked" teaser until you flip one env var at go-live.

### Verification done
- ✅ **Production build passes** — TypeScript clean, all 12 routes compile (Next.js 16 / Turbopack).
- ✅ **Security review passed** on the critical multi-tenant surface:
  - RLS isolates every table by `agency_id`; forged IDs can't cross tenants.
  - The Supabase service-role key (which bypasses RLS) is server-only — importing it into browser code is a build error.
  - Both webhooks (Stripe, Vapi) verify their signatures.
  - Every server action re-checks authentication (not trusting the UI).
- ✅ **No secrets committed** — only `.env.example` is in the repo; real keys stay local / in Vercel.

---

## 3. Important nuance: "pushed to GitHub" ≠ "live" (now resolved)

Pushing code to GitHub does **not** by itself make Sonika live — two things had to be
set up in the cloud, and both are now done:

1. ✅ **Vercel connected to the repo** — pushes to `main` auto-deploy.
2. ✅ **Production env + database set up** — prod Supabase project, migrations applied, and the 4 required env vars set in Vercel (site URL + Supabase URL/anon/service-role keys).

**Gotchas hit and solved along the way (worth remembering):**
- **Vercel env vars, not `.env.local`.** Production reads env vars from the Vercel dashboard; `.env.local` only affects local dev. Keys pasted into `.env.local` do nothing in prod.
- Vercel env-var changes **only take effect after a redeploy.**
- The prod Supabase project uses Supabase's **new API-key system** (`sb_publishable_…` / `sb_secret_…`). The app expects the **legacy `anon` / `service_role` JWT keys** (start with `eyJ…`), under the **"Legacy anon, service…"** tab in Settings → API Keys. Wrong family → "Invalid API key."
- Supabase **email confirmation was turned off** so signup lands straight in the dashboard. If re-enabled, the signup form needs a "check your inbox" state added first.
- **`PROVISIONING_MOCK=1` overrides everything.** It was left set in Vercel and forced mock provisioning (fake `+1555…` numbers) even with real keys present. Removed it to get real provisioning.
- **Twilio requires KYC before buying numbers.** Purchases failed with `20003 "Primary compliance profile is not approved"` until the **Trust Hub → Primary Customer Profile** (Individual) was completed and **Approved**.
- **Vapi's `/phone-number/import` uses the Twilio Auth Token, not a scoped API key.** Sending `twilioApiKeySid/Secret` is rejected ("property should not exist"). The scoped `SK…` key is still used for the direct Twilio *purchase*; only the Vapi import needs `TWILIO_AUTH_TOKEN`.
- **Stripe prices are immutable and mode-scoped** — see Step 6.

---

## 4. What's left to do (go-live checklist)

Work through these in order. Items marked **[required]** are needed for a functional
live site; **[when ready]** items you can defer until you actually want paid features on.

### Step 1 — Connect Vercel to the repo ✅ **[DONE]**
- Vercel is connected to `leviduncan/sonika`; pushes to `main` auto-deploy. Live at trysonika.com.

### Step 2 — Create the production Supabase project ✅ **[DONE]**
- Prod project `sonika-os-db` created; migrations applied (5 tables present):
  1. `20260625120000_init.sql` (schema + RLS + signup trigger)
  2. `20260627120000_add_seat_vapi_phone_number_id.sql`
  3. `20260627150000_agency_billing.sql`
  4. `20260710120000_add_sub_account_brief.sql` — **⚠️ NOT YET APPLIED TO PROD.** Adds the `sub_accounts.brief` column. Until it's applied (`supabase db push`, or run the SQL in the Supabase SQL editor), adding a client on prod will fail because the insert references `brief`. Apply this before the agency demo.
- Used the **legacy `anon` + `service_role` JWT keys** (Settings → API Keys → "Legacy anon, service…" tab), not the new `sb_*` keys.

### Step 3 — Set production environment variables in Vercel ✅ **[DONE]**
These 4 are set and verified working:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://trysonika.com` — auth redirects + metadata |
| `NEXT_PUBLIC_SUPABASE_URL` | prod Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | legacy anon JWT (`eyJ…`), browser-safe, RLS-enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | legacy service_role JWT (`eyJ…`), **secret** — server only |

Also done in Supabase: **email confirmation turned off**, and **Site URL** set to the prod URL.

### Step 4 — Open the front door ⬜ **[NEXT — required when you want public signups]**
- Currently **parked**: the landing page shows no signup/login links; you reach `/signup` by direct URL.
- Set `NEXT_PUBLIC_SIGNUP_OPEN=1` in Vercel + redeploy to surface Sign up / Log in links publicly.
- Recommendation: keep it parked while lining up your first agency conversations; flip it when ready to accept self-serve signups.

### Step 4.5 — (Optional, free) Test the full app flow in mock mode
- From the dashboard, **+ Add Client** → provision it. With no Vapi/Twilio/Stripe keys set, the whole chain runs in mock mode: generates a prompt, "creates" an assistant, "assigns" a number, flips the client **live** — with fake IDs, **spending nothing.** Validates the provisioning UX end-to-end before real keys.

### Step 5 — Turn on real provisioning ✅ **[DONE — spends money]**
These are set in Vercel and real provisioning is verified working:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude — generates each agent's system prompt |
| `JINA_API_KEY` | *(optional)* Website reader for prompt tailoring. Keyless by default — set only for higher rate limits. `SCRAPE_TIMEOUT_MS` / `SCRAPE_MAX_CHARS` also optional. |
| `VAPI_API_KEY` | Vapi — creates the voice assistant (use the **Private** key, not Public) |
| `VAPI_WEBHOOK_URL` | `https://trysonika.com/api/webhooks/vapi` — where end-of-call reports post |
| `VAPI_WEBHOOK_SECRET` | shared secret to authenticate incoming Vapi webhooks |
| `TWILIO_ACCOUNT_SID` + `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET` | Twilio — buys the number |
| `TWILIO_AUTH_TOKEN` | **required** — Vapi's number import authenticates with this, not the API key |

Prerequisites that had to be true (and now are):
- `PROVISIONING_MOCK` **must not be set** (it forces mock).
- Twilio **Trust Hub Primary Customer Profile = Approved** (KYC), or number purchase fails with `20003`.
- Twilio account funded (each number ~$1.15 + small monthly + ~$0.05–0.10/min Vapi).
- Voice default is **Vapi "Clara" (V2)**; override via `VAPI_VOICE_ID` (e.g. `Elliot`), `VAPI_VOICE_PROVIDER`, `VAPI_VOICE_VERSION`.

> ⚠️ Provisioning a client now **buys a real Twilio number and creates a real Vapi assistant** — real cost. Deleting a client releases the number and deletes the assistant (recurring charges stop; the one-time number fee is sunk). See §7 for who-pays-what.

### Step 6 — Turn on billing ⬜ **[IN PROGRESS — not yet verified]**
Stripe keys **are set** in Vercel (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`), but **checkout is not yet confirmed working**. Currently **`BILLING_MOCK=1`** is set, which drops the "subscribe before provisioning" paywall — so provisioning is ungated for now (fine for the demo).

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | use `sk_test_…` first to test free, then live key |
| `STRIPE_PRICE_ID` | your recurring per-seat price |
| `STRIPE_WEBHOOK_SECRET` | from the Stripe dashboard webhook config |

To finish billing:
- Point a Stripe webhook at `https://trysonika.com/api/webhooks/stripe`.
- Ensure `STRIPE_PRICE_ID` is a **recurring** price in the **same mode** (test vs live) as `STRIPE_SECRET_KEY`. A mode mismatch or a one-time price throws on checkout.
- Run a full **test-mode** checkout end-to-end; then remove `BILLING_MOCK` to re-enable the paywall.

> **Where the price is set:** the amount charged is **not in the code** — it lives on the Stripe **Price** object referenced by `STRIPE_PRICE_ID`. The app multiplies that recurring per-seat price by the live-seat count. Stripe price amounts are **immutable**: to change the price, create a *new* Price in the Stripe dashboard, then update `STRIPE_PRICE_ID` in `.env.local` (restart dev) and Vercel (redeploy). Archive the old price so it isn't reused.

### Step 7 — Email **[when ready]**
- Add `RESEND_API_KEY` for transactional email.

### Step 8 — Compliance
- ✅ **Twilio Trust Hub (Primary Customer Profile, Individual) = Approved** — this was required to buy numbers at all, and is done.
- ⬜ **A2P 10DLC registration** is still required **only if you add SMS** (it has lead time). Inbound **voice** does not need it, so it's not blocking the current voice product. Start it when SMS enters scope — and note it prefers a registered business/EIN, so revisit once the LLC exists.

---

## 5. Recommended go-live sequence

1. ✅ **Soft launch (free) — DONE.** Live app on trysonika.com, signup working.
2. ✅ **Real provisioning — DONE.** Real agent + number + inbound call logging verified (Bayside Plumbing).
3. **← YOU ARE HERE: record the demo video.** A real, callable agent ("Clara") with a live CRM/call-log is ready to film. See `docs/demo-video-script.md` if created.
4. **Finish billing:** Step 6 — confirm a Stripe **test-mode** checkout end-to-end, then remove `BILLING_MOCK` to re-enable the paywall; later switch to live keys.
5. **Open the doors:** flip `NEXT_PUBLIC_SIGNUP_OPEN=1` when ready for public signups; add 10DLC only if/when SMS enters scope.

---

## 6. Open questions / things to confirm
- **Apply the `brief` migration to prod, then verify the tailoring live** — the website-read scrape (Jina Reader) and the optional **"About this client" brief** were added 2026-07-09/10, *after* the 2026-07-03 end-to-end verification, so they haven't been exercised in production. **First apply migration #4 to prod** (see Step 2) — adding a client will fail without it. Then provision a client with a brief + content-rich site and confirm the generated prompt reflects the brief's facts/rules (and that a blocked/slow site still yields a specific agent from the brief alone). It all runs in the same synchronous request; the page's `maxDuration` was raised to 60s to give the longer chain headroom. Local scrape + prompt-branching are already verified; the untested path is a real provision with live Claude/Vapi/Twilio keys.
- **When to open public signups?** (Flip `NEXT_PUBLIC_SIGNUP_OPEN=1` — currently parked.)
- **Finish Stripe billing** — verify a test-mode checkout, confirm `STRIPE_PRICE_ID` is recurring + same-mode as the secret key, then drop `BILLING_MOCK`.
- **Is SMS in scope?** If so, start Twilio **A2P 10DLC** (needs lead time; prefers a registered business/EIN).
- Custom **email confirmation** flow: keep it off (current) or re-enable with a "check your inbox" screen added?
- **Margin/churn policy** (see §7): setup fee per client? hold vs release numbers?

---

## 7. Billing economics — who pays what

Two separate money flows:

**A. Provider costs (Twilio number, Vapi minutes, Claude) → always the operator (you).**
Provisioning spends on *your* accounts: Twilio number (~$1.15 + small monthly), Vapi (~$0.05–0.10/min), Claude (fractions of a cent). Deleting a client releases the number and deletes the assistant, so recurring charges stop — but the one-time number fee is already sunk.

**B. The agency's card (Stripe per-seat) → prorated, mostly nets out on quick changes.**
Your paying customer is the **agency**, billed per **live seat**. A seat going live bumps the Stripe quantity up (proration); deleting drops it (proration credit). Because prorations land on the next invoice, a quick add-then-delete roughly nets to ~$0 for the agency — they mainly pay for seats that stay live across a cycle. Quantity floors at **1** (a subscribed agency always pays for ≥1 seat). The paywall (`isBillingEnforced`) blocks provisioning unless the agency has an active/trialing subscription — so non-payers can't burn your provider budget. *(Currently bypassed by `BILLING_MOCK=1`.)*

**Margin risk:** churn — agencies spinning agents up/down burn your Twilio number fees without matching revenue. Mitigations to consider: a per-client **setup/activation fee**, **holding/reusing numbers** instead of releasing immediately, or a **minimum commitment**.
