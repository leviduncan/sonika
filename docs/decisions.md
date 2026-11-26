# Decisions

Running log of why we chose what we chose. Newest first.

## 2026-11-26 — Follow-up (not fixed): root `proxy.ts`

The feat/password-reset review flagged an issue in the root `proxy.ts`. It is
out of scope for the password-reset fix branch and is logged here so it isn't
lost. What the current file does that needs a decision:

- The matcher's negative lookahead `(?!api|_next/static|…)` isn't anchored to
  a path segment, so it skips *any* path that starts with `api` (e.g. `/apiary`),
  not just `/api/*`.
- The extension exclusion `.*\.(?:svg|png|jpg|…)$` applies to every path, so
  `/dashboard/anything.png` bypasses the proxy's session refresh and the
  optimistic `/dashboard` gate. Pages still call `requireProfile()` and RLS is
  the real boundary, so this isn't a data leak, but the gate shouldn't have holes.

Fix on its own branch: anchor the exclusions (`api/`, `_next/static/`, …) and
limit the extension skip to public assets.

## 2026-11-26 — Password reset hardening (review fixes)

**Decision.** `/auth/confirm` is a page, not a GET route that verifies. GET only
renders a "Continue" button; the `confirmRecovery` Server Action verifies the
`token_hash` on POST. Only `type=recovery` is accepted, and the PKCE `?code=`
fallback was removed (a code can't be checked for type before it's exchanged).
`next` is an exact allowlist (`/reset-password`, `/dashboard`), anything else
goes to `/dashboard`.

**Why.** Email security scanners prefetch links and were able to burn the
single-use token before the user clicked. A Server Action also gets Next's
Origin check, so the POST can't be used for login CSRF. Prefix-based "is it
relative?" checks keep missing browser quirks (`//host`, `/\t/host`), and an
allowlist can't.

**Recovery proof.** A recovery link and a password login produce the same kind
of Supabase session, so the session alone can't gate a password change. After a
successful recovery we set `sonika_recovery`: httpOnly, secure, sameSite=lax,
15 minutes, HMAC-signed and bound to the user id (key: `RECOVERY_COOKIE_SECRET`,
or derived from `SUPABASE_SERVICE_ROLE_KEY` when that isn't set). `updatePassword`
verifies it server-side and clears it on success; password login and logout
clear it too.

**Also.** If signing out other devices fails after the password changes, the
user is told and offered a retry (logged server-side), rather than sent to the
dashboard as if all was well. The forgot form returns one message for every
outcome, including rate limits and send failures; real errors are logged
server-side only.

**Prod prerequisite.** With the PKCE fallback gone, production reset links only
work once `supabase/templates/recovery.html` is pasted into Supabase > Auth >
Email Templates > Reset Password (the default template sends a `?code=` link).

## 2026-11-26 — Password reset links use `token_hash`, not the PKCE code

**Decision.** The reset email links to `/auth/confirm?token_hash=…&type=recovery`
(custom Supabase template, `supabase/templates/recovery.html`), which calls
`verifyOtp` server-side. (Superseded in part by the hardening entry above: the
PKCE `?code=` fallback has since been removed.)

**Why.** `@supabase/ssr` uses PKCE, and a PKCE code only exchanges in the
browser that requested the email (the verifier lives in its cookies). Agency
owners often request a reset on a laptop and open the email on a phone. The
`token_hash` link works on any device.

**Also.** The forgot form shows the same "on its way" message whether or not
the email has an account (no account enumeration). A successful reset signs out
the user's other sessions.

## 2026-06-27 — Per-seat Stripe billing & provisioning gate

**Model.** One Stripe customer + one subscription per agency; the subscription's
single per-seat item carries `quantity` = live seat count. On every
provision/remove we recompute the agency's live-seat count and set the item
quantity (self-correcting, avoids drift). Quantity floored at 1 to dodge
Stripe's empty-item edge. Subscription state (`stripe_subscription_id`,
`stripe_subscription_item_id`, `subscription_status`) lives on `agencies`,
synced by the Stripe webhook (service role) keyed on `metadata.agency_id`.

**Provisioning requires an active subscription** (when billing is enabled). A
live seat costs Sonika real Vapi+Twilio money, so letting an unpaid agency
provision is a direct margin leak. The provision button gates to the billing
page until the agency is `active`/`trialing`.

**Env-gated, like the provider integrations.** No `STRIPE_SECRET_KEY` ⇒ billing
is "not configured" and the gate is skipped, so local dev runs without Stripe.
`BILLING_MOCK=1` (mirrors `PROVISIONING_MOCK`) keeps Stripe fully wired —
checkout, portal, webhooks, and seat-quantity sync all still run — but drops the
"subscribe before provisioning" paywall, so you can keep a real test key in
`.env.local` and still provision without checking out first. The split is
deliberate: `isBillingEnabled()` gates "is Stripe wired up at all" (checkout,
sync), while `isBillingEnforced()` (= enabled AND not mocked) gates only the
provisioning paywall.

**Twilio auth uses a scoped API Key** (SK… + secret), not the master Auth Token,
with an Auth-Token fallback; Vapi import accepts either. Sonika's Twilio numbers
live in a **dedicated top-level Twilio project** (not a subaccount of the
agency's own account — subaccounts can't nest, and Sonika must stay a potential
parent for per-agency subaccounts later).

## 2026-06-22 — Multi-tenant data model & RLS strategy

**Decision.** Tenant isolation keys on a single `agency_id` column denormalized
onto every business table (`sub_accounts`, `seats`, `call_logs`). RLS policies
are a flat `agency_id = auth_agency_id()` check, where `auth_agency_id()` is a
`security definer` SQL function reading the caller's `profiles` row.

**Why.**
- Denormalizing `agency_id` keeps every policy a single indexed equality with no
  joins — fast and obviously correct, which matters because RLS is our *only*
  isolation layer (CLAUDE.md: RLS, not separate DBs).
- `security definer` on the agency lookup avoids the classic `profiles` RLS
  recursion problem.

**Modeled "seat" as the billable unit** (one provisioned voice agent), separate
from `sub_account`, so per-seat Stripe billing maps 1:1 to a subscription item
and a sub-account can hold multiple agents later. UI stays 1 seat per sub-account
for MVP.

**Server-role boundary.** `call_logs`, provisioning writes, Stripe/Vapi webhooks,
and new-user bootstrap all run server-side with the service-role key (bypasses
RLS). Browser only ever uses the anon key. Claude/Vapi/Twilio secrets never reach
the client.

Full schema, ERD, RLS, and provisioning flow: [architecture.md](architecture.md).
