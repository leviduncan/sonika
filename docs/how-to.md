# Sonika — How to Use

End-user (agency-facing) usage docs. We append a short block here each time we
ship + verify a feature slice, while the flow is fresh. Prose now; screenshots
and final polish happen near launch once the UI freezes. Positioning per
CLAUDE.md: this is **voice infrastructure for agencies** — never "AI receptionist,"
and we don't name Vapi/Claude/Twilio as the value prop.

> Status: pre-launch MVP. Flows still change week to week — treat anything here as
> a working draft until a slice is marked **Stable**.

---

## 1. Create your agency & sign in

_Status: built (local). Screenshots: TODO at launch._

Your agency is your top-level workspace. Everything — clients, voice agents,
billing — lives inside it.

**Create an agency**

1. Go to **/signup**.
2. Enter your **agency name**, your **name**, a **work email**, and a **password**
   (at least 8 characters).
3. Select **Create agency**. You're taken straight to your dashboard.

The first person to sign up becomes the agency **owner**. Your workspace is
private to your agency — no one outside it can see your clients or data.

**Sign in / out**

- Sign in anytime at **/login** with your email and password.
- Use **Sign out** (top-right of the dashboard) to end your session.
- Visiting the dashboard while signed out sends you to the login page.

---

## 2. Add & manage clients

_Status: built (local). Screenshots: TODO at launch._

Each end-client is a **sub-account** in your workspace. This is where their voice
agent and phone number will live.

**Add a client**

1. On the dashboard, select **+ Add client**.
2. Enter the **client name** (e.g. _Bayside Dental_).
3. Optionally paste their **website URL** — a bare domain like `baysidedental.com`
   is fine; we'll tidy it up. (Soon this is what we use to auto-build their agent.)
4. Select **Create client**.

The client appears in your **Client sub-accounts** list with a **status** badge.
New clients start as **draft**.

**Client statuses**

| Status         | Meaning                                              |
| -------------- | ---------------------------------------------------- |
| `draft`        | Created, not yet set up.                             |
| `provisioning` | Being set up (voice agent + number).                 |
| `active`       | Live and handling calls.                             |
| `paused`       | Temporarily switched off.                            |

**Remove a client**

- Select **Remove** on a client's row and confirm. This can't be undone.

> You only ever see and manage your own agency's clients.

---

## 3. Provision a client's voice agent

_Status: built (local, mocked services). Screenshots: TODO at launch._

Once a client has a website, Sonika can stand up their voice agent — system
prompt, AI assistant, and a phone number — in one click.

**Provision an agent**

1. On the dashboard, find the client (they must have a **website** — if not,
   you'll see "add website to provision"; edit the client to add one).
2. Select **Provision agent** on that client's row.
3. Sonika generates the agent, assigns a number, and goes live. The row then
   shows a **green pulse + phone number**, and the client's status flips to
   **active**.

**If provisioning fails**

- The client returns to **draft** and the row shows **Retry**. Select it to try
  again — nothing is double-charged or duplicated.

> One agent (one number) per client for now. Multiple agents per client comes
> later.

---

## 4. View a client's call log

_Status: built (local; ingestion verified via simulated webhook). Screenshots: TODO at launch._

Every call the client's agent answers is logged automatically.

1. On the dashboard, **click the client's name** to open their page.
2. The **Call log** lists each call — caller number, time, duration, why it
   ended, a one-line summary, an expandable **transcript**, and a **recording**
   link when available.

You only see your own agency's clients and their calls.

> How it works: when a call ends, the voice platform sends Sonika a report and
> the call is saved to that client automatically — no manual entry. (Requires a
> public webhook URL in production; not reachable from local dev without a tunnel.)

---

## 5. Billing

_Status: built; verified live in Stripe test mode. Screenshots: TODO at launch._

You pay per **live seat** — one seat for each client whose voice agent is live.

1. Open **Billing** (top-right of the dashboard).
2. Select **Set up billing** → you're taken to Stripe Checkout to add a card and
   start your subscription. (In test mode, use card `4242 4242 4242 4242`, any
   future expiry/CVC.)
3. Back in Sonika, your subscription shows **Active** and your live-seat count.
4. After that, **Manage billing** opens the Stripe portal to update your card,
   see invoices, or cancel.

**Why you're asked to set up billing before provisioning:** each live agent
costs real money to run, so an agency needs an active subscription before it can
provision agents. Once active, provisioning a client **adds a seat** to your
subscription automatically; removing a client **drops** it.

> If Stripe isn't configured in an environment, the billing page says so and
> provisioning runs without billing (useful for local testing).

---

## Coming next (not yet built)

- **Edit a client's agent** — update or regenerate an agent's behaviour after
  setup (today an agent is built once at provisioning; changing it means removing
  and re-provisioning the client).
- **Deployment** — moving from local to a hosted environment.
- **Transactional email** — sign-up + notification emails.
