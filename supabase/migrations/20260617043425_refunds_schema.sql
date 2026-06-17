create type public.refund_status as enum (
  'created', 'pending', 'succeeded', 'failed', 'canceled'
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  mode public.payment_mode not null,
  status public.refund_status not null default 'created',
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reason text,
  merchant_refund_id text,
  provider_refund_id text,
  provider_response jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (merchant_id, mode, merchant_refund_id)
);

create index refunds_payment_id_idx on public.refunds(payment_id);
create index refunds_merchant_created_idx on public.refunds(merchant_id, created_at desc);
create index refunds_status_idx on public.refunds(status) where status in ('created', 'pending');

create trigger set_refunds_updated_at
before update on public.refunds
for each row execute function public.set_updated_at();

create or replace function public.enforce_refund_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_amount numeric(14, 2);
  v_payment_status public.payment_status;
  v_total_refunded numeric(14, 2);
begin
  select amount_gross, status into v_payment_amount, v_payment_status
  from public.payments
  where id = new.payment_id;

  if v_payment_amount is null then
    raise exception 'payment % not found', new.payment_id;
  end if;

  if v_payment_status not in ('succeeded') then
    raise exception 'cannot refund a payment with status %', v_payment_status;
  end if;

  select coalesce(sum(amount), 0) into v_total_refunded
  from public.refunds
  where payment_id = new.payment_id
    and id is distinct from new.id
    and status in ('created', 'pending', 'succeeded');

  if v_total_refunded + new.amount > v_payment_amount then
    raise exception 'refund amount % exceeds remaining refundable amount %',
      new.amount, v_payment_amount - v_total_refunded;
  end if;

  return new;
end;
$$;

create trigger enforce_refund_limit_trigger
before insert or update on public.refunds
for each row execute function public.enforce_refund_limit();

alter table public.refunds enable row level security;

create policy "members can view refunds"
on public.refunds
for select
to authenticated
using (public.is_merchant_member(merchant_id));

grant select on public.refunds to authenticated;
grant all on public.refunds to service_role;
revoke all on public.refunds from anon;

alter table public.payments
  add column if not exists refunded_amount numeric(14, 2) not null default 0
    check (refunded_amount >= 0),
  add column if not exists fully_refunded_at timestamptz;

create or replace function public.refresh_payment_refund_totals(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric(14, 2);
  v_gross numeric(14, 2);
begin
  select coalesce(sum(amount), 0) into v_total
  from public.refunds
  where payment_id = p_payment_id
    and status = 'succeeded';

  select amount_gross into v_gross
  from public.payments
  where id = p_payment_id;

  update public.payments
  set
    refunded_amount = v_total,
    fully_refunded_at = case
      when v_total >= v_gross then coalesce(fully_refunded_at, now())
      else null
    end
  where id = p_payment_id;
end;
$$;

create or replace function public.refunds_update_payment_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_payment_refund_totals(coalesce(new.payment_id, old.payment_id));
  return coalesce(new, old);
end;
$$;

create trigger refunds_refresh_payment_totals
after insert or update or delete on public.refunds
for each row execute function public.refunds_update_payment_totals();
