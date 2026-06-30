-- ════════════════════════════════════════════════════════════════════
-- Sonika — initial schema, RLS, and new-user bootstrap.
-- Source of truth: docs/architecture.md. Tenant boundary = agency_id,
-- denormalized onto every business table; isolation enforced by RLS.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Enums (status state machines)
-- ─────────────────────────────────────────────────────────────
create type agency_role        as enum ('owner', 'admin', 'member');
create type sub_account_status as enum ('draft', 'provisioning', 'active', 'paused');
create type seat_status        as enum ('pending', 'provisioning', 'live', 'failed', 'suspended');

-- ─────────────────────────────────────────────────────────────
-- agencies — the tenant root
-- ─────────────────────────────────────────────────────────────
create table agencies (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text unique,                 -- white-label subdomain handle
  stripe_customer_id text unique,
  created_at         timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- profiles — app users, 1:1 with auth.users, scoped to one agency
-- ─────────────────────────────────────────────────────────────
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  agency_id  uuid not null references agencies (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       agency_role not null default 'member',
  created_at timestamptz not null default now()
);
create index on profiles (agency_id);

-- ─────────────────────────────────────────────────────────────
-- sub_accounts — the agency's end-clients
-- ─────────────────────────────────────────────────────────────
create table sub_accounts (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies (id) on delete cascade,
  name        text not null,
  website_url text,
  status      sub_account_status not null default 'draft',
  created_at  timestamptz not null default now()
);
create index on sub_accounts (agency_id);

-- ─────────────────────────────────────────────────────────────
-- seats — one provisioned voice agent; the per-seat billing unit
-- ─────────────────────────────────────────────────────────────
create table seats (
  id                          uuid primary key default gen_random_uuid(),
  agency_id                   uuid not null references agencies (id) on delete cascade,
  sub_account_id              uuid not null references sub_accounts (id) on delete cascade,
  vapi_assistant_id           text,               -- set after Vapi provisioning
  twilio_number               text,               -- E.164, set after Twilio provisioning
  twilio_phone_sid            text,
  system_prompt               text,               -- Claude-generated, server-side only
  status                      seat_status not null default 'pending',
  stripe_subscription_item_id text,
  created_at                  timestamptz not null default now()
);
create index on seats (agency_id);
create index on seats (sub_account_id);

-- ─────────────────────────────────────────────────────────────
-- call_logs — calls handled by a seat's agent (written by Vapi webhook)
-- ─────────────────────────────────────────────────────────────
create table call_logs (
  id               uuid primary key default gen_random_uuid(),
  agency_id        uuid not null references agencies (id) on delete cascade,
  seat_id          uuid references seats (id) on delete set null,
  sub_account_id   uuid references sub_accounts (id) on delete set null,
  vapi_call_id     text unique,
  caller_number    text,
  duration_seconds integer,
  recording_url    text,
  transcript       text,
  summary          text,
  ended_reason     text,
  started_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index on call_logs (agency_id);
create index on call_logs (seat_id);

-- ════════════════════════════════════════════════════════════════════
-- Grants
-- ════════════════════════════════════════════════════════════════════
-- RLS decides *which rows* a caller sees; table GRANTs decide whether the
-- PostgREST roles can touch the table at all. Both are required — without
-- these, even an RLS-passing query returns "permission denied". `service_role`
-- bypasses RLS but still needs the grant. `anon` (pre-login) is intentionally
-- given nothing: our policies key on auth_agency_id(), which is null for anon.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- ════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════

-- Resolve the current user's agency. SECURITY DEFINER bypasses RLS on the
-- profiles read, which prevents policy recursion (profiles' own policy
-- would otherwise call back into this function).
create or replace function auth_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from profiles where id = auth.uid()
$$;

-- profiles: see yourself + agency colleagues; can only edit yourself.
alter table profiles enable row level security;
create policy profiles_select on profiles for select
  using (agency_id = auth_agency_id());
create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- agencies: see only your own agency.
alter table agencies enable row level security;
create policy agencies_select on agencies for select
  using (id = auth_agency_id());

-- Tenant-scoped tables: full read/write within your own agency.
alter table sub_accounts enable row level security;
create policy sub_accounts_rw on sub_accounts for all
  using      (agency_id = auth_agency_id())
  with check (agency_id = auth_agency_id());

alter table seats enable row level security;
create policy seats_rw on seats for all
  using      (agency_id = auth_agency_id())
  with check (agency_id = auth_agency_id());

-- call_logs: agency members may read their calls. Writes come from the
-- Vapi webhook via the service-role key (bypasses RLS) — no insert/update
-- policy is granted to the anon role on purpose.
alter table call_logs enable row level security;
create policy call_logs_select on call_logs for select
  using (agency_id = auth_agency_id());

-- ════════════════════════════════════════════════════════════════════
-- New-user bootstrap
-- ════════════════════════════════════════════════════════════════════
-- A brand-new auth user has no agency yet, so RLS would block any insert
-- they attempt. We resolve the chicken-and-egg in a SECURITY DEFINER
-- trigger that fires when a row lands in auth.users: it creates the
-- agency and the owner profile atomically. Agency name + full name are
-- passed through auth user_metadata at sign-up time.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_agency_id uuid;
  agency_name   text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'agency_name'), ''), 'My Agency');
  full_name     text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
begin
  insert into agencies (name) values (agency_name)
  returning id into new_agency_id;

  insert into profiles (id, agency_id, email, full_name, role)
  values (new.id, new_agency_id, new.email, full_name, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
