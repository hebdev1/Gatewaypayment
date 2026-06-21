-- Model A — Settlement
-- See app/admin/payouts and app/dashboard/payouts for the UI.

create type public.payout_destination_type as enum (
  'moncash', 'bank_account', 'cash_pickup'
);

create table public.payout_destinations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  mode public.payment_mode not null,
  type public.payout_destination_type not null,
  moncash_phone text check (moncash_phone is null or moncash_phone ~ '^[0-9]{8,15}$'),
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  bank_swift text,
  nickname text,
  is_default boolean not null default false,
  verified_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_destination_type_filled check (
    (type = 'moncash' and moncash_phone is not null)
    or (type = 'bank_account' and bank_account_number is not null and bank_name is not null)
    or (type = 'cash_pickup')
  )
);

create index payout_destinations_merchant_idx
  on public.payout_destinations(merchant_id, mode)
  where archived_at is null;

create unique index payout_destinations_one_default_idx
  on public.payout_destinations(merchant_id, mode)
  where is_default = true and archived_at is null;

create trigger set_payout_destinations_updated_at
before update on public.payout_destinations
for each row execute function public.set_updated_at();

alter table public.payout_destinations enable row level security;
create policy "members can read their destinations" on public.payout_destinations for select to authenticated using (public.is_merchant_member(merchant_id));
create policy "admins can read all destinations" on public.payout_destinations for select to authenticated using (public.is_app_admin());
grant select on public.payout_destinations to authenticated;
grant all on public.payout_destinations to service_role;

create type public.payout_status as enum (
  'scheduled', 'pending', 'processing', 'succeeded',
  'failed', 'awaiting_manual', 'canceled'
);

create type public.payout_schedule as enum (
  'manual_only', 'daily', 'weekly', 'monthly'
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  mode public.payment_mode not null,
  destination_id uuid references public.payout_destinations(id) on delete set null,
  destination_snapshot jsonb not null default '{}'::jsonb,
  amount_gross numeric(14, 2) not null check (amount_gross > 0),
  provider_fee numeric(14, 2) not null default 0 check (provider_fee >= 0),
  amount_net numeric(14, 2) not null check (amount_net >= 0),
  currency text not null default 'HTG' check (currency ~ '^[A-Z]{3}$'),
  status public.payout_status not null default 'scheduled',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  provider_response jsonb not null default '{}'::jsonb,
  provider_transaction_id text,
  manual_completed_by uuid references auth.users(id) on delete set null,
  manual_reference text,
  scheduled_for timestamptz not null default now(),
  attempted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payouts_merchant_idx on public.payouts(merchant_id, created_at desc);
create index payouts_pending_idx on public.payouts(scheduled_for, status)
  where status in ('scheduled', 'pending', 'failed') and attempts < 5;
create index payouts_status_idx on public.payouts(status);
create index payouts_destination_idx on public.payouts(destination_id) where destination_id is not null;

create trigger set_payouts_updated_at
before update on public.payouts
for each row execute function public.set_updated_at();

alter table public.payouts enable row level security;
create policy "members can read their payouts" on public.payouts for select to authenticated using (public.is_merchant_member(merchant_id));
create policy "admins can read all payouts" on public.payouts for select to authenticated using (public.is_app_admin());
grant select on public.payouts to authenticated;
grant all on public.payouts to service_role;

alter table public.merchants
  add column if not exists payout_schedule public.payout_schedule not null default 'weekly',
  add column if not exists payout_day_of_week smallint default 2 check (payout_day_of_week is null or payout_day_of_week between 0 and 6),
  add column if not exists payout_day_of_month smallint default 1 check (payout_day_of_month is null or payout_day_of_month between 1 and 28),
  add column if not exists payout_min_amount numeric(14, 2) not null default 500 check (payout_min_amount >= 0),
  add column if not exists auto_payouts_enabled boolean not null default false;

create or replace view public.merchant_available_balance as
with modes(mode) as ( select unnest(enum_range(null::public.payment_mode)) )
select
  m.id as merchant_id,
  modes.mode,
  m.default_currency as currency,
  coalesce((select sum(p.merchant_net_amount) from public.payments p where p.merchant_id = m.id and p.mode = modes.mode and p.status = 'succeeded'), 0)
  - coalesce((select sum(r.amount) from public.refunds r where r.merchant_id = m.id and r.mode = modes.mode and r.status = 'succeeded'), 0)
  - coalesce((select sum(po.amount_gross) from public.payouts po where po.merchant_id = m.id and po.mode = modes.mode and po.status in ('scheduled', 'pending', 'processing', 'succeeded', 'awaiting_manual')), 0) as available_amount
from public.merchants m cross join modes;

grant select on public.merchant_available_balance to authenticated;
