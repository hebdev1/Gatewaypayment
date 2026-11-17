create schema marketplace_private;
revoke all on schema marketplace_private from public, anon, authenticated;
grant usage on schema marketplace_private to authenticated;

create table public.products (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  type text not null,
  category text not null check (category in ('Top-ups', 'Gift cards', 'Game codes', 'Subscriptions')),
  mark text not null,
  tone text not null,
  price integer not null check (price between 1 and 1000000),
  tag text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'paid', 'fulfilled', 'cancelled')),
  subtotal_cents integer not null check (subtotal_cents > 0),
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);

create table public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity between 1 and 99),
  unit_price_cents integer not null check (unit_price_cents > 0),
  primary key (order_id, product_id)
);

create index order_items_product_idx on public.order_items (product_id);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.products, public.orders, public.order_items from public, anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.orders, public.order_items to authenticated;

create policy products_read_active on public.products
  for select to anon, authenticated using (active);

create policy orders_read_own on public.orders
  for select to authenticated using (user_id = (select auth.uid()));

create policy order_items_read_own on public.order_items
  for select to authenticated using (
    order_id in (select id from public.orders where user_id = (select auth.uid()))
  );

create function marketplace_private.create_marketplace_order(requested_items jsonb, request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_id uuid := auth.uid();
  saved_order_id uuid;
  requested_count integer;
  valid_count integer;
  distinct_count integer;
  order_subtotal integer;
  snapshot jsonb;
begin
  if customer_id is null or request_id is null then
    raise exception 'Sign in before placing an order' using errcode = '42501';
  end if;
  if jsonb_typeof(requested_items) is distinct from 'array' then
    raise exception 'Provide a list of products' using errcode = '22023';
  end if;
  requested_count := jsonb_array_length(requested_items);
  if requested_count < 1 or requested_count > 25 then
    raise exception 'Provide between 1 and 25 products' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(customer_id::text || ':' || request_id::text, 0));
  select orders.id into saved_order_id
    from public.orders as orders
    where orders.user_id = customer_id
      and orders.request_id = create_marketplace_order.request_id;
  if found then
    return saved_order_id;
  end if;

  select count(*), count(distinct p.id), sum(p.price * item.quantity),
    jsonb_agg(jsonb_build_object(
      'product_id', p.id, 'product_name', p.name, 'quantity', item.quantity, 'unit_price_cents', p.price
    ))
  into valid_count, distinct_count, order_subtotal, snapshot
  from jsonb_to_recordset(requested_items) as item(product_id text, quantity integer)
  join public.products as p on p.id = item.product_id and p.active
  where item.quantity between 1 and 99;

  if valid_count <> requested_count or distinct_count <> requested_count then
    raise exception 'The order contains unavailable or invalid items' using errcode = '22023';
  end if;

  insert into public.orders (user_id, request_id, subtotal_cents)
    values (customer_id, request_id, order_subtotal) returning id into saved_order_id;

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price_cents)
    select saved_order_id, item.product_id, item.product_name, item.quantity, item.unit_price_cents
    from jsonb_to_recordset(snapshot)
      as item(product_id text, product_name text, quantity integer, unit_price_cents integer);

  return saved_order_id;
end;
$$;

create function public.create_marketplace_order(requested_items jsonb, request_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select marketplace_private.create_marketplace_order(requested_items, request_id);
$$;

revoke all on function marketplace_private.create_marketplace_order(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.create_marketplace_order(jsonb, uuid) from public, anon, authenticated;
grant execute on function marketplace_private.create_marketplace_order(jsonb, uuid) to authenticated;
grant execute on function public.create_marketplace_order(jsonb, uuid) to authenticated;

insert into public.products (id, name, type, category, mark, tone, price, tag, sort_order) values
  ('free-fire', 'Free Fire', 'Diamonds', 'Top-ups', 'FF', 'orange', 105, 'Hot', 10),
  ('pubg-mobile', 'PUBG Mobile', 'UC', 'Top-ups', 'P', 'gold', 99, 'Best seller', 20),
  ('call-of-duty', 'Call of Duty', 'CP', 'Top-ups', 'COD', 'silver', 149, '', 30),
  ('mobile-legends', 'Mobile Legends', 'Diamonds', 'Top-ups', 'ML', 'blue', 115, '−5%', 40),
  ('roblox', 'Roblox', 'Robux', 'Top-ups', 'R', 'red', 499, '', 50),
  ('valorant', 'Valorant', 'Points', 'Top-ups', 'V', 'coral', 500, 'New', 60),
  ('steam', 'Steam', 'Wallet', 'Gift cards', 'S', 'navy', 500, '', 70),
  ('playstation', 'PlayStation', 'Gift card', 'Gift cards', 'PS', 'royal', 1000, '', 80);
