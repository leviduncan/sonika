-- Per-agency Stripe billing state. One customer + one subscription per agency;
-- the subscription's single per-seat item carries quantity = live seat count.
-- subscription_status mirrors Stripe (active|trialing|past_due|canceled|...);
-- 'none' means billing not set up. Updated by the Stripe webhook (service role).
alter table agencies add column stripe_subscription_id      text;
alter table agencies add column stripe_subscription_item_id text;
alter table agencies add column subscription_status         text not null default 'none';
