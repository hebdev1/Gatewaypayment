-- Sprint 1.2 — multi-currency, payment links, invoices

create table public.currency_rates (
  currency text primary key check (currency ~ '^[A-Z]{3}$'),
  rate_to_htg numeric(18, 8) not null check (rate_to_htg > 0),
  source text not null default 'frankfurter',
  fetched_at timestamptz not null default now()
);

insert into public.currency_rates (currency, rate_to_htg, source) values
  ('HTG', 1, 'seed'),
  ('USD', 132.5, 'seed'),
  ('EUR', 143.8, 'seed'),
  ('CAD', 96.0, 'seed'),
  ('DOP', 2.2, 'seed')
on conflict (currency) do nothing;

alter table public.currency_rates enable row level security;
create policy "anyone can read rates" on public.currency_rates for select to anon, authenticated using (true);
grant select on public.currency_rates to anon, authenticated;
grant all on public.currency_rates to service_role;

alter table public.payments
  add column if not exists display_amount numeric(14, 2),
  add column if not exists display_currency text check (display_currency is null or display_currency ~ '^[A-Z]{3}$'),
  add column if not exists exchange_rate_used numeric(18, 8);

create type public.payment_link_status as enum ('active', 'archived');

create table public.payment_links (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  mode public.payment_mode not null,
  slug text not null,
  name text not null,
  description text,
  amount numeric(14, 2),
  currency text not null default 'HTG' check (currency ~ '^[A-Z]{3}$'),
  allow_custom_amount boolean not null default false,
  min_amount numeric(14, 2),
  max_amount numeric(14, 2),
  collect_customer_email boolean not null default true,
  collect_customer_phone boolean not null default false,
  collect_customer_name boolean not null default false,
  max_uses integer,
  use_count integer not null default 0,
  success_url text,
  expires_at timestamptz,
  status public.payment_link_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_links_slug_unique unique (slug),
  constraint payment_links_amount_check check ((allow_custom_amount = true) or (amount is not null and amount > 0))
);

create index payment_links_merchant_idx on public.payment_links(merchant_id, created_at desc);
create trigger set_payment_links_updated_at before update on public.payment_links for each row execute function public.set_updated_at();
alter table public.payment_links enable row level security;
create policy "members can read their payment links" on public.payment_links for select to authenticated using (public.is_merchant_member(merchant_id));
create policy "admins can read all payment links" on public.payment_links for select to authenticated using (public.is_app_admin());
create policy "anyone can read active payment links by slug" on public.payment_links for select to anon, authenticated using (status = 'active' and (expires_at is null or expires_at > now()));
grant select on public.payment_links to anon, authenticated;
grant all on public.payment_links to service_role;

alter table public.payments
  add column if not exists payment_link_id uuid references public.payment_links(id) on delete set null,
  add column if not exists invoice_id uuid;
create index if not exists payments_link_idx on public.payments(payment_link_id) where payment_link_id is not null;

create type public.invoice_status as enum ('draft', 'open', 'paid', 'void', 'uncollectible');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  mode public.payment_mode not null,
  slug text not null,
  number text not null,
  customer_email text not null,
  customer_name text,
  customer_phone text,
  description text,
  notes text,
  subtotal_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  currency text not null default 'HTG' check (currency ~ '^[A-Z]{3}$'),
  due_at timestamptz,
  status public.invoice_status not null default 'draft',
  paid_at timestamptz,
  sent_at timestamptz,
  voided_at timestamptz,
  payment_link_id uuid references public.payment_links(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_slug_unique unique (slug),
  constraint invoices_merchant_number_unique unique (merchant_id, mode, number)
);

create index invoices_merchant_idx on public.invoices(merchant_id, created_at desc);
create index invoices_status_idx on public.invoices(status);
create trigger set_invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null default 0,
  description text not null,
  quantity numeric(14, 2) not null default 1 check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  amount numeric(14, 2) not null check (amount >= 0)
);

create index invoice_items_invoice_idx on public.invoice_items(invoice_id, position);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy "members can read their invoices" on public.invoices for select to authenticated using (public.is_merchant_member(merchant_id));
create policy "admins can read all invoices" on public.invoices for select to authenticated using (public.is_app_admin());
create policy "anyone can read open invoices by slug" on public.invoices for select to anon, authenticated using (status in ('open', 'paid'));
create policy "members can read their invoice items" on public.invoice_items for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id and public.is_merchant_member(i.merchant_id)));
create policy "anyone can read items of public invoices" on public.invoice_items for select to anon, authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id and i.status in ('open', 'paid')));

grant select on public.invoices to anon, authenticated;
grant select on public.invoice_items to anon, authenticated;
grant all on public.invoices to service_role;
grant all on public.invoice_items to service_role;

alter table public.payments add constraint payments_invoice_fkey foreign key (invoice_id) references public.invoices(id) on delete set null;
create index if not exists payments_invoice_idx on public.payments(invoice_id) where invoice_id is not null;

create or replace function public.invoice_mark_paid_on_payment_success()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'succeeded' and new.invoice_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'succeeded') then
    update public.invoices set status = 'paid', paid_at = coalesce(paid_at, now())
    where id = new.invoice_id and status not in ('paid', 'void');
  end if;
  return new;
end; $$;
revoke execute on function public.invoice_mark_paid_on_payment_success() from public, anon, authenticated;
create trigger invoice_mark_paid_trigger after insert or update on public.payments for each row execute function public.invoice_mark_paid_on_payment_success();

create or replace function public.payment_link_bump_use_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'succeeded' and new.payment_link_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'succeeded') then
    update public.payment_links set use_count = use_count + 1 where id = new.payment_link_id;
  end if;
  return new;
end; $$;
revoke execute on function public.payment_link_bump_use_count() from public, anon, authenticated;
create trigger payment_link_bump_trigger after insert or update on public.payments for each row execute function public.payment_link_bump_use_count();

create or replace function public.convert_to_htg(p_amount numeric, p_currency text)
returns table (htg_amount numeric, rate numeric)
language plpgsql stable security invoker set search_path = '' as $$
declare v_rate numeric;
begin
  if upper(p_currency) = 'HTG' then return query select p_amount, 1::numeric; return; end if;
  select rate_to_htg into v_rate from public.currency_rates where currency = upper(p_currency);
  if v_rate is null then raise exception 'Unsupported currency %', p_currency; end if;
  return query select round(p_amount * v_rate, 2), v_rate;
end; $$;
grant execute on function public.convert_to_htg(numeric, text) to anon, authenticated;

create or replace function public.fetch_rates_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'functions_base_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'rates_fetcher_secret' order by created_at desc limit 1;
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url || '/fetch-rates',
    headers := jsonb_build_object('content-type', 'application/json', 'x-internal-secret', v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 20000
  );
end; $$;
revoke execute on function public.fetch_rates_tick() from public, anon, authenticated;

do $$ begin perform cron.unschedule('fetch-rates-tick'); exception when others then null; end $$;
select cron.schedule('fetch-rates-tick', '7 6 * * *', $cron$select public.fetch_rates_tick();$cron$);
