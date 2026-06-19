alter table public.merchants
  add column if not exists preferred_language text not null default 'fr'
    check (preferred_language in ('en', 'fr', 'ht'));

alter table public.payment_links
  add column if not exists locale text check (locale is null or locale in ('en', 'fr', 'ht'));

alter table public.invoices
  add column if not exists locale text check (locale is null or locale in ('en', 'fr', 'ht'));

alter table public.api_keys
  add column if not exists allowed_ips text[];

create index if not exists api_keys_allowed_ips_idx
  on public.api_keys using gin (allowed_ips)
  where allowed_ips is not null;
