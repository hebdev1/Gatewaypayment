create type public.app_admin_role as enum ('super', 'support');

create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_admin_role not null default 'support',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  notes text
);

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins
    where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_app_admin() from public, anon, authenticated;
grant execute on function public.is_app_admin() to authenticated;

alter table public.app_admins enable row level security;

create policy "admins can read admins list"
on public.app_admins
for select
to authenticated
using (public.is_app_admin());

grant select on public.app_admins to authenticated;
grant all on public.app_admins to service_role;
revoke all on public.app_admins from anon;

create policy "admins can read all merchants"
on public.merchants
for select
to authenticated
using (public.is_app_admin());

create policy "admins can read all payments"
on public.payments
for select
to authenticated
using (public.is_app_admin());

create policy "admins can read all payment events"
on public.payment_events
for select
to authenticated
using (public.is_app_admin());

create policy "admins can read all refunds"
on public.refunds
for select
to authenticated
using (public.is_app_admin());

create policy "admins can read all webhook endpoints"
on public.webhook_endpoints
for select
to authenticated
using (public.is_app_admin());

create policy "admins can read all webhook deliveries"
on public.webhook_deliveries
for select
to authenticated
using (public.is_app_admin());

create policy "admins can read all kyc submissions"
on public.kyc_submissions
for select
to authenticated
using (public.is_app_admin());

create policy "admins can read all merchant members"
on public.merchant_members
for select
to authenticated
using (public.is_app_admin());

create policy "admins can read all api keys"
on public.api_keys
for select
to authenticated
using (public.is_app_admin());

create policy "admins can read all provider accounts"
on public.payment_provider_accounts
for select
to authenticated
using (public.is_app_admin());

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  before_value jsonb,
  after_value jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index admin_audit_log_actor_idx on public.admin_audit_log(actor_user_id, created_at desc);
create index admin_audit_log_target_idx on public.admin_audit_log(target_table, target_id);

alter table public.admin_audit_log enable row level security;

create policy "admins can read audit log"
on public.admin_audit_log
for select
to authenticated
using (public.is_app_admin());

grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;
revoke all on public.admin_audit_log from anon;
