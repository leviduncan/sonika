# Sonika — Project Status & Go-Live Guide

_Last updated: 2026-07-01_

This is a standalone status snapshot written to be readable without repo access
(safe to paste into Claude Chat). It covers what Sonika is, what's built and
verified, what remains, and the exact steps to take it live.

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

**The full MVP application code is committed and pushed to GitHub** (`origin/main`,
commit `149c3ef`). Before this, only the marketing landing page was in the repo;
the entire app (~3,600 lines) was sitting uncommitted on the local machine. It's
now version-controlled and intentional.

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

## 3. Important nuance: "pushed to GitHub" ≠ "live"

Pushing code to GitHub does **not** by itself make Sonika live. Two things stand between the current state and a working production site:

1. **A Vercel project must be connected to the GitHub repo** for a push to trigger a deploy. _(This connection is not yet confirmed — see Step 1 below.)_
2. **Production environment variables and the database must be set up in the cloud.** The code ships with local-development defaults that point at a localhost database, which won't work in production until overridden.

---

## 4. What's left to do (go-live checklist)

Work through these in order. Items marked **[required]** are needed for a functional
live site; **[when ready]** items you can defer until you actually want paid features on.

### Step 1 — Connect Vercel to the repo **[required]**
- Log in to Vercel, import the GitHub repo `leviduncan/sonika` (or confirm it's already linked).
- Once linked, every push to `main` auto-deploys. Confirm a build ran on commit `149c3ef`.

### Step 2 — Create the production Supabase project **[required]**
- Create a new Supabase project (separate from local dev).
- Run the 3 database migrations against it (the SQL files under `supabase/migrations/`), via `supabase db push` or by pasting them into the Supabase SQL editor **in filename order**:
  1. `20260625120000_init.sql` (schema + RLS + signup trigger)
  2. `20260627120000_add_seat_vapi_phone_number_id.sql`
  3. `20260627150000_agency_billing.sql`
- From the Supabase project settings, copy the **Project URL**, the **anon key**, and the **service-role key**.

### Step 3 — Set production environment variables in Vercel **[required]**
In the Vercel project → Settings → Environment Variables, add:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | your production URL (e.g. `https://sonika.app`) | used for auth redirects + metadata |
| `NEXT_PUBLIC_SUPABASE_URL` | prod Supabase project URL | from Step 2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key | browser-safe, RLS-enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service-role key | **secret** — server only, never `NEXT_PUBLIC_` |

Redeploy after adding these. **At this point you have a working live app** — agencies can sign up, log in, and use the dashboard. Provisioning and billing run in "mock" mode (no real phone numbers, no charges) until you add the keys below.

### Step 4 — Open the front door **[required, when you want signups]**
- Set `NEXT_PUBLIC_SIGNUP_OPEN=1` in Vercel to surface Sign up / Log in links on the landing page. (Leave it off to keep the site a parked teaser while you test.)

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

### Step 7 — Email **[when ready]**
- Add `RESEND_API_KEY` for transactional email.

### Step 8 — Compliance before real calls **[required before real phone traffic]**
- Twilio **A2P 10DLC registration** is required for SMS and to avoid carrier filtering on US numbers. This has a lead time — start it early if SMS is in scope.

---

## 5. Recommended go-live sequence

1. **Soft launch (free):** Steps 1–4. Live app, real signups, provisioning + billing in mock mode. Nothing costs money. Good for demos and first agency conversations.
2. **Enable provisioning:** Step 5 in a controlled way — provision one test client, confirm a real call flows into the call log.
3. **Enable billing:** Step 6 in Stripe **test mode** first, run a full checkout, then switch to live keys.
4. **Flip fully live:** real Stripe keys, signup open, 10DLC registered.

---

## 6. Open questions / things to confirm
- Is the Vercel ↔ GitHub integration already set up, or does it need creating?
- What's the production domain?
- Do you have accounts + keys ready for Supabase (prod), Vapi, Twilio, Stripe, Resend?
- Is SMS in scope for launch? (If so, start Twilio 10DLC registration now due to lead time.)
