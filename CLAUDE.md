@AGENTS.md
# Sonika

Voice infrastructure for marketing agencies. A white-label B2B2B SaaS platform.
Agencies sign up, create sub-accounts for their end-clients, paste a client's
website URL, and Sonika auto-generates an AI voice agent, provisions a Twilio
number via the Vapi API, and deploys a working AI receptionist in minutes.
Agencies manage everything from one dashboard and resell to clients at their
own margin.

**Buyer:** marketing agencies, web shops, fractional CMOs, consultants (1–20 ppl).
NOT the end-customer. Every decision answers: "does this make an agency say yes?"

## Stack
- Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel
- Supabase — auth + multi-tenant Postgres
- Vapi — AI voice agents (via API)
- Twilio — phone numbers, SMS, A2P 10DLC
- Stripe — per-seat subscription billing
- Resend — transactional email
- Claude API — agent prompt generation, content enhancement
- n8n (self-hosted, n8n.growclientsai.com) — workflow orchestration where needed

## MVP Scope (Weeks 1–7) — build ONLY this
- Multi-tenant app with agency-level auth (Supabase Auth)
- Agency dashboard: create + manage end-client sub-accounts
- Onboarding flow: paste end-client URL → Claude generates system prompt →
  Vapi assistant provisioned → Twilio number assigned → live in <10 min
- Call log viewer, per end-client sub-account
- Stripe per-seat billing
- Basic transactional email (Resend)

## Out of Scope (do NOT build before week 8 without explicit sign-off)
Advanced analytics, voice cloning, multi-language, CRM integrations,
mobile app, public API (all v2+).

## Architectural Principles
- Multi-tenancy via Supabase row-level security — NOT separate databases
- Vapi assistants + Twilio numbers provisioned per end-client seat, not per agency
- All Claude API calls route through ONE server-side service (cost monitoring)
- Ship ugly and working over polished and late. Shippable artifact by end of Week 3.

## Copy / Naming Rules (for any user-facing text)
- Positioning: "voice infrastructure for marketing agencies." NEVER "AI receptionist."
- Never name Vapi, Claude, or n8n as the value prop. Sell margin and recovered
  revenue to the agency, not the underlying tech.

## Context Pointers
- /docs/prd.md — full MVP definition
- /docs/architecture.md — schema, multi-tenancy, provisioning flow
- /docs/decisions.md — running log of why we chose what we chose