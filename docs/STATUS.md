# Sonika — Project Status & Go-Live Guide

_Last updated: 2026-07-01_

This is a standalone status snapshot written to be readable without repo access
(safe to paste into Claude Chat). It covers what Sonika is, what's built and
verified, what remains, and the exact steps to take it live.

> ## 🟢 STATUS: SOFT-LAUNCHED & LIVE
> Sonika is deployed and working in production at **https://trysonika.com**.
> A real agency account has signed up, been auto-provisioned an agency +
> owner profile, and reached the dashboard — proving the full multi-tenant
> backend works live. **Steps 1–3 of the go-live checklist are done.**
> The app currently runs with **provisioning and billing in mock mode**
> (nothing spends money), and the public landing page is still **parked**
> (signups by direct URL only) until the front door is opened (Step 4).

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

### Proven working in production (verified 2026-07-01)
- ✅ **Vercel deploy** connected to the GitHub repo; pushes to `main` auto-deploy.
- ✅ **Landing page** renders at trysonika.com (currently in parked/teaser mode by design).
- ✅ **Prod Supabase** connected with valid keys; the 3 migrations are applied (all 5 tables exist).
- ✅ **Signup works end-to-end** — a real account ("Levi Marketing") signed up, the DB trigger auto-created the agency + owner profile, the auth session held, and the dashboard rendered its (empty) RLS-scoped client list.

### What's built and in the repo
- **Multi-tenant database schema** — agencies, profiles, sub-accounts (end-clients), seats (one provisioned voice agent = the billing unit), call logs. Tenant isolation enforced by Postgres Row-Level Security keyed on `agency_id`.
- **Agency authentication** — signup, login, logout. New signups auto-create an agency + owner profile via a database trigger.
- **Agency dashboard** — create and manage end-client sub-accounts, view call logs per client.
- **Provisioning flow** — paste a client website → Claude generates a system prompt → Vapi assistant created → Twilio number purchased and attached → agent goes live. Includes automatic teardown if any step fails (so a crash never leaves a paid phone number or orphaned assistant behind).
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
- The prod Supabase project uses Supabase's **new API-key system** (`sb_publishable_…` / `sb_secret_…`). The app expects the **legacy `anon` / `service_role` JWT keys** (start with `eyJ…`), found under the **"Legacy anon, service…"** tab in Settings → API Keys. Using the wrong family throws "Invalid API key."
- Supabase **email confirmation was turned off** so signup lands straight in the dashboard. If it's ever re-enabled, the signup form needs a "check your inbox" state added first.
- Vercel env-var changes **only take effect after a redeploy.**

---

## 4. What's left to do (go-live checklist)

Work through these in order. Items marked **[required]** are needed for a functional
live site; **[when ready]** items you can defer until you actually want paid features on.

### Step 1 — Connect Vercel to the repo ✅ **[DONE]**
- Vercel is connected to `leviduncan/sonika`; pushes to `main` auto-deploy. Live at trysonika.com.

### Step 2 — Create the production Supabase project ✅ **[DONE]**
- Prod project `sonika-os-db` created; all 3 migrations applied (5 tables present):
  1. `20260625120000_init.sql` (schema + RLS + signup trigger)
  2. `20260627120000_add_seat_vapi_phone_number_id.sql`
  3. `20260627150000_agency_billing.sql`
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

### Step 5 — Turn on real provisioning **[when ready — this spends money]**
Add these to Vercel to make provisioning create real agents and buy real numbers:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude — generates each agent's system prompt |
| `VAPI_API_KEY` | Vapi — creates the voice assistant |
| `VAPI_WEBHOOK_URL` | **Your production HTTPS URL** + `/api/webhooks/vapi` — assistants provisioned with a wrong/localhost URL will log calls nowhere |
| `VAPI_WEBHOOK_SECRET` | shared secret to authenticate incoming Vapi webhooks |
| `TWILIO_ACCOUNT_SID` + `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET` | Twilio — buys and manages phone numbers |

> ⚠️ Once these are set, provisioning a client **purchases a real Twilio number and creates a real Vapi assistant, which cost money.** Keep them unset (or set `PROVISIONING_MOCK=1`) until you're ready.

### Step 6 — Turn on billing **[when ready]**
| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | use `sk_test_…` first to test free, then live key |
| `STRIPE_PRICE_ID` | your recurring per-seat price |
| `STRIPE_WEBHOOK_SECRET` | from the Stripe dashboard webhook config |

- Point a Stripe webhook at `https://your-domain/api/webhooks/stripe`.
- With billing on, agencies must subscribe before they can provision agents. To keep billing wired but drop the paywall during testing, set `BILLING_MOCK=1`.

> **Where the price is set:** the amount charged is **not in the code** — it lives on the Stripe **Price** object referenced by `STRIPE_PRICE_ID`. The app multiplies that recurring per-seat price by the live-seat count. Stripe price amounts are **immutable**: to change the price, create a *new* Price in the Stripe dashboard, then update `STRIPE_PRICE_ID` in `.env.local` (restart dev) and Vercel (redeploy). Archive the old price so it isn't reused.

### Step 7 — Email **[when ready]**
- Add `RESEND_API_KEY` for transactional email.

### Step 8 — Compliance before real calls **[required before real phone traffic]**
- Twilio **A2P 10DLC registration** is required for SMS and to avoid carrier filtering on US numbers. This has a lead time — start it early if SMS is in scope.

---

## 5. Recommended go-live sequence

1. ✅ **Soft launch (free) — DONE.** Live app on trysonika.com, signup working, provisioning + billing in mock mode. Nothing costs money.
2. **← YOU ARE HERE.** Optionally test the provisioning UX in mock mode (Step 4.5), and decide when to open public signups (Step 4). Line up first agency conversations.
3. **Enable provisioning:** Step 5, in a controlled way — provision one test client, confirm a real call flows into the call log. *(First step that spends money.)*
4. **Enable billing:** Step 6 in Stripe **test mode** first, run a full checkout, then switch to live keys.
5. **Flip fully live:** real Stripe keys, signup open, 10DLC registered.

---

## 6. Open questions / things to confirm
- **When to open public signups?** (Flip `NEXT_PUBLIC_SIGNUP_OPEN=1` — currently parked.)
- Do you have accounts + keys ready for **Vapi, Twilio, Stripe, Resend** for the paid steps?
- **Is SMS in scope for launch?** If so, start Twilio **A2P 10DLC** registration now — it has a lead time.
- Custom **email confirmation** flow: keep it off (current) or re-enable with a "check your inbox" screen added?
