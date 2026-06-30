# Decisions

Running log of why we chose what we chose. Newest first.

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
