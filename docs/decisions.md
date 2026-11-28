# Decisions

Running log of why we chose what we chose. Newest first.

## 2026-11-27 — Supabase calls give up after 3 seconds

**Decision.** `src/lib/supabase/deadline.ts` gives a client one 3 s budget. An
answer that doesn't arrive, a network error, a 5xx or a 429 is "unknown", which
is never read as signed in or signed out.

- **Proxy.** Unknown passes the request through with no redirect, so public
  pages still render. Cookies saved before the deadline are kept; later writes
  are ignored. It logs one warning with no user data.
- **Page checks** (`src/lib/dal.ts`, so also `requireProfile()` inside Server
  Actions). Unknown throws and shows the error page. Pages and actions use
  protected data only after `requireProfile()` returns.
- **Sign out.** If Supabase doesn't confirm in time, this browser's session
  cookies are deleted anyway. The server-side session is not revoked then.
- **Everything else** (sign in, sign up, password reset actions) has no limit yet.

**Why.** auth-js retries a failed refresh for about 30 s, so `/` took 25–33 s
during an outage. Aborting the request doesn't stop the retries, so the deadline
stops waiting on its own.

**Worst case.** A protected page can take about 6 s to show the error: 3 s in the
proxy, then 3 s in the page check.

**Refresh tokens.** A render can refresh a token but can't save it. On local
Supabase, reusing the old token 12 s and 24 s later returned the same new token,
so the next request recovers. Hosted Supabase has not been checked.

## 2026-11-27 — A signed-in user without a usable profile

**Decision.** `requireProfile()` now tells three cases apart:

- Signed out → `/login`.
- Signed in, no profile row → `/account-unavailable`, a generic page with Sign
  out. It is outside the proxy's auth and protected routes.
- The profile query fails → it throws, and `src/app/error.tsx` shows generic
  copy with "Try again" and "Sign out". No message, stack or ids are rendered.

**Why.** All three used to go to `/login`. With the proxy running, a signed-in
user is bounced from `/login` to `/dashboard`, so a missing profile looped until
the browser gave up. The query uses `.maybeSingle()` because `.single()`
reports a missing row as an error.

**Testing.** The suite now changes the local database (revokes `select` on
`profiles`, then restores it). `tests/support/local-supabase.ts` aborts the run
unless both the API and the database (port 54322) are on this machine. `pg` is a
new dev dependency for that connection.

## 2026-11-26 — Proxy lives in `src/proxy.ts` (fixes the follow-up below)

**Decision.** The proxy moved to `src/proxy.ts`, so it now runs. Turning it on
exposed problems in code that had never executed, fixed in the same change:

- **Matcher.** Every exclusion is anchored to the start of the path: `api/`,
  `_next/static/`, `_next/image`, `fonts/`, the favicon and icon, and the two
  social preview images. There is no blanket file-extension skip, so a new
  public asset goes through the proxy until it is listed.
- **Redirects keep the session.** Both redirects copy the cookies and no-cache
  headers Supabase set during that request. Before, a refreshed or cleared
  session was dropped.
- **No shared caching of session cookies.** `setAll` applies the headers
  `@supabase/ssr` passes. Without them, a prerendered page such as `/` went out
  with new session cookies and `Cache-Control: s-maxage=31536000`.
- **Only GET and HEAD are redirected.** A Server Action is a POST to the page's
  own path. Redirecting it broke "Add client" for a user whose session was gone
  (error page instead of `/login`). The proxy still refreshes the session on
  POSTs.

**Consequence.** The proxy is a convenience layer, not the authorization
boundary: every protected page and Server Action must keep calling
`requireProfile()` (or check the user itself), with RLS underneath.

**Checking it.** `tests/auth/proxy.spec.ts`; `next build` should list
`ƒ Proxy (Middleware)`.

## 2026-11-26 — Follow-up (fixed above): root `proxy.ts`

**The root `proxy.ts` never runs.** The app lives in `src/app`, and Next 16
only picks up the proxy file at the same level as `app` (so `src/proxy.ts`).
`next build` lists no Proxy, and `.next/server/functions-config-manifest.json`
has no `/_middleware` entry (a working `src/proxy.ts` produces one). Don't use
`middleware-manifest.json` to check: it stays empty even when the proxy works.
This predates password reset: the file has been in the wrong place since it
was added in 149c3ef, and `main` has the same problem.

Consequences today:

- No per-request session refresh. Server Actions still save refreshed auth
  cookies through `src/lib/supabase/server.ts`, but a refresh that happens while
  a page renders is thrown away (Server Components can't set cookies).
- `/dashboard` is protected only by each page's `requireProfile()` and by RLS.
  The proxy's optimistic `/dashboard` redirect never fires.
- The proxy's "signed-in users skip these" list does nothing.

**`/forgot-password` is not in that list.** The password-reset branch first
added it, then took it out. A user who opens a reset link is signed in, so once
the proxy runs, listing `/forgot-password` would bounce them to the dashboard
when their 15-minute recovery cookie expires, with no way to request a new link.

**Fix (own branch, not part of password reset):** move `proxy.ts` to
`src/proxy.ts`. Once it runs, the path-filter holes in its matcher become real
and need fixing in the same change:

- The negative lookahead `(?!api|_next/static|…)` isn't anchored to a path
  segment, so it skips *any* path starting with `api` (e.g. `/apiary`), not
  just `/api/*`.
- The extension exclusion `.*\.(?:svg|png|jpg|…)$` applies to every path, so
  `/dashboard/anything.png` would skip the session refresh and the `/dashboard`
  gate. Anchor the exclusions (`api/`, `_next/static/`, …) and limit the
  extension skip to public assets.

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
The link is built from `{{ .SiteURL }}`, so the production Site URL must be
`https://trysonika.com`. The app no longer sends a `redirectTo` (it was built
from the request's Origin header and the template ignored it anyway).

**Required production settings (Supabase > Auth).** The recovery cookie only
gates the app's own reset form. Supabase's session cookie is readable by the
page and the anon key is public, so a signed-in session could still call
Supabase's update-user endpoint directly. Two settings narrow that, both
already on in `supabase/config.toml` for local:

- **Secure password change** on (`secure_password_change = true`): a password
  change needs a recent sign-in or reauthentication.
- **Password changed notification** email on (template:
  `supabase/templates/password_changed_notification.html`), so the owner hears
  about any change, whichever way it was made.

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
