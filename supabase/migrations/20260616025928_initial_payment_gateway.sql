create extension if not exists pgcrypto with schema extensions;

create type public.payment_mode as enum ('sandbox', 'live');
create type public.merchant_status as enum ('pending', 'active', 'suspended');
create type public.payment_provider as enum ('moncash');
create type public.payment_status as enum ('created', 'pending', 'succeeded', 'failed', 'canceled', 'expired');
create type public.webhook_delivery_status as enum ('pending', 'sending', 'succeeded', 'failed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  legal_name text,
  email text,
  phone text,
  country_code text not null default 'HT' check (country_code ~ '^[A-Z]{2}$'),
  default_currency text not null default 'HTG' check (default_currency ~ '^[A-Z]{3}$'),
  status public.merchant_status not null default 'pending',
  live_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchants_display_name_not_blank check (length(btrim(display_name)) > 0)
);

create table public.merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'developer', 'viewer')),
  created_at timestamptz not null default now(),
  unique (merchant_id, user_id)
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  mode public.payment_mode not null,
  name text not null,
  prefix text not null,
  last_four text not null,
  scopes text[] not null default array['payments:create', 'payments:read'],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint api_keys_name_not_blank check (length(btrim(name)) > 0)
);

create table public.api_key_secrets (
  api_key_id uuid primary key references public.api_keys(id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now()
);

create table public.payment_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  provider public.payment_provider not null,
  mode public.payment_mode not null,
  enabled boolean not null default false,
  provider_fee_bps integer not null default 0 check (provider_fee_bps >= 0 and provider_fee_bps <= 10000),
  provider_fee_fixed numeric(14, 2) not null default 0 check (provider_fee_fixed >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, provider, mode)
);

create table public.payment_provider_credentials (
  account_id uuid primary key references public.payment_provider_accounts(id) on delete cascade,
  credentials_ciphertext text not null,
  nonce text not null,
  key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  provider public.payment_provider not null default 'moncash',
  mode public.payment_mode not null,
  status public.payment_status not null default 'created',
  merchant_order_id text not null,
  provider_order_id text,
  provider_transaction_id text,
  provider_payment_token text,
  hosted_checkout_url text,
  provider_checkout_url text,
  amount_gross numeric(14, 2) not null check (amount_gross > 0),
  gateway_fee_bps integer not null default 250 check (gateway_fee_bps >= 0 and gateway_fee_bps <= 10000),
  gateway_fee_amount numeric(14, 2) not null check (gateway_fee_amount >= 0),
  provider_fee_amount numeric(14, 2) not null default 0 check (provider_fee_amount >= 0),
  merchant_net_amount numeric(14, 2) not null check (merchant_net_amount >= 0),
  currency text not null default 'HTG' check (currency ~ '^[A-Z]{3}$'),
  customer_email text,
  customer_phone text,
  description text,
  success_url text,
  cancel_url text,
  metadata jsonb not null default '{}'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (merchant_id, mode, merchant_order_id)
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  mode public.payment_mode not null,
  url text not null,
  description text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint webhook_endpoints_url_http check (url ~ '^https?://')
);

create table public.webhook_endpoint_secrets (
  endpoint_id uuid primary key references public.webhook_endpoints(id) on delete cascade,
  secret_ciphertext text not null,
  nonce text not null,
  key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  event_type text not null,
  payload jsonb not null,
  status public.webhook_delivery_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  response_status integer,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index merchants_owner_user_id_idx on public.merchants(owner_user_id);
create index merchant_members_user_id_idx on public.merchant_members(user_id);
create index merchant_members_merchant_id_idx on public.merchant_members(merchant_id);
create index api_keys_merchant_id_idx on public.api_keys(merchant_id);
create index api_keys_active_lookup_idx on public.api_keys(merchant_id, mode) where revoked_at is null;
create index payment_provider_accounts_merchant_id_idx on public.payment_provider_accounts(merchant_id);
create index payments_merchant_created_idx on public.payments(merchant_id, created_at desc);
create index payments_status_idx on public.payments(status);
create index payments_provider_transaction_idx on public.payments(provider, provider_transaction_id) where provider_transaction_id is not null;
create index payment_events_payment_id_idx on public.payment_events(payment_id);
create index payment_events_merchant_id_idx on public.payment_events(merchant_id);
create index webhook_endpoints_merchant_id_idx on public.webhook_endpoints(merchant_id);
create index webhook_deliveries_pending_idx on public.webhook_deliveries(next_attempt_at, status) where status in ('pending', 'failed');
create index webhook_deliveries_merchant_id_idx on public.webhook_deliveries(merchant_id);

create trigger set_merchants_updated_at
before update on public.merchants
for each row execute function public.set_updated_at();

create trigger set_payment_provider_accounts_updated_at
before update on public.payment_provider_accounts
for each row execute function public.set_updated_at();

create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger set_webhook_endpoints_updated_at
before update on public.webhook_endpoints
for each row execute function public.set_updated_at();

create trigger set_webhook_deliveries_updated_at
before update on public.webhook_deliveries
for each row execute function public.set_updated_at();

create or replace function public.is_merchant_member(target_merchant_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.merchants m
    where m.id = target_merchant_id
      and m.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.merchant_members mm
    where mm.merchant_id = target_merchant_id
      and mm.user_id = (select auth.uid())
  );
$$;

alter table public.merchants enable row level security;
alter table public.merchant_members enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_key_secrets enable row level security;
alter table public.payment_provider_accounts enable row level security;
alter table public.payment_provider_credentials enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_endpoint_secrets enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy "owners can create merchants"
on public.merchants
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

create policy "members can view their merchants"
on public.merchants
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or exists (
    select 1 from public.merchant_members mm
    where mm.merchant_id = id and mm.user_id = (select auth.uid())
  )
);

create policy "owners can update merchants"
on public.merchants
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

create policy "members can view own membership"
on public.merchant_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.merchants m
    where m.id = merchant_id and m.owner_user_id = (select auth.uid())
  )
);

create policy "owners can add themselves as first member"
on public.merchant_members
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'owner'
  and exists (
    select 1 from public.merchants m
    where m.id = merchant_id and m.owner_user_id = (select auth.uid())
  )
);

create policy "members can view api key metadata"
on public.api_keys
for select
to authenticated
using (public.is_merchant_member(merchant_id));

create policy "members can view provider account metadata"
on public.payment_provider_accounts
for select
to authenticated
using (public.is_merchant_member(merchant_id));

create policy "members can view payments"
on public.payments
for select
to authenticated
using (public.is_merchant_member(merchant_id));

create policy "members can view payment events"
on public.payment_events
for select
to authenticated
using (public.is_merchant_member(merchant_id));

create policy "members can view webhook endpoints"
on public.webhook_endpoints
for select
to authenticated
using (public.is_merchant_member(merchant_id));

create policy "members can view webhook deliveries"
on public.webhook_deliveries
for select
to authenticated
using (public.is_merchant_member(merchant_id));

create view public.merchant_balance_summary
with (security_invoker = true)
as
select
  merchant_id,
  mode,
  currency,
  count(*) filter (where status = 'succeeded') as successful_payment_count,
  coalesce(sum(amount_gross) filter (where status = 'succeeded'), 0)::numeric(14, 2) as gross_volume,
  coalesce(sum(gateway_fee_amount) filter (where status = 'succeeded'), 0)::numeric(14, 2) as gateway_fees,
  coalesce(sum(provider_fee_amount) filter (where status = 'succeeded'), 0)::numeric(14, 2) as provider_fees,
  coalesce(sum(merchant_net_amount) filter (where status = 'succeeded'), 0)::numeric(14, 2) as merchant_net_balance
from public.payments
group by merchant_id, mode, currency;

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on public.merchants to authenticated;
grant select, insert on public.merchant_members to authenticated;
grant select on public.api_keys to authenticated;
grant select on public.payment_provider_accounts to authenticated;
grant select on public.payments to authenticated;
grant select on public.payment_events to authenticated;
grant select on public.webhook_endpoints to authenticated;
grant select on public.webhook_deliveries to authenticated;
grant select on public.merchant_balance_summary to authenticated;

grant all on public.merchants to service_role;
grant all on public.merchant_members to service_role;
grant all on public.api_keys to service_role;
grant all on public.api_key_secrets to service_role;
grant all on public.payment_provider_accounts to service_role;
grant all on public.payment_provider_credentials to service_role;
grant all on public.payments to service_role;
grant all on public.payment_events to service_role;
grant all on public.webhook_endpoints to service_role;
grant all on public.webhook_endpoint_secrets to service_role;
grant all on public.webhook_deliveries to service_role;
grant select on public.merchant_balance_summary to service_role;

revoke all on public.merchants from anon;
revoke all on public.merchant_members from anon;
revoke all on public.api_keys from anon;
revoke all on public.api_key_secrets from anon, authenticated;
revoke all on public.payment_provider_accounts from anon;
revoke all on public.payment_provider_credentials from anon, authenticated;
revoke all on public.payments from anon;
revoke all on public.payment_events from anon;
revoke all on public.webhook_endpoints from anon;
revoke all on public.webhook_endpoint_secrets from anon, authenticated;
revoke all on public.webhook_deliveries from anon;
revoke all on public.merchant_balance_summary from anon;
