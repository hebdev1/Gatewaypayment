create type public.kyc_status as enum (
  'not_started', 'draft', 'submitted', 'approved', 'rejected'
);

create table public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  status public.kyc_status not null default 'draft',
  business_data jsonb not null default '{}'::jsonb,
  document_urls jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kyc_submissions_merchant_idx on public.kyc_submissions(merchant_id, created_at desc);
create index kyc_submissions_status_idx on public.kyc_submissions(status)
  where status in ('submitted');

create trigger set_kyc_submissions_updated_at
before update on public.kyc_submissions
for each row execute function public.set_updated_at();

alter table public.kyc_submissions enable row level security;

create policy "members can view kyc"
on public.kyc_submissions
for select
to authenticated
using (public.is_merchant_member(merchant_id));

grant select on public.kyc_submissions to authenticated;
grant all on public.kyc_submissions to service_role;
revoke all on public.kyc_submissions from anon;

create or replace function public.kyc_apply_to_merchant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'approved' then
    update public.merchants
    set status = 'active', live_enabled = true
    where id = new.merchant_id;
  elsif new.status = 'rejected' then
    update public.merchants
    set live_enabled = false
    where id = new.merchant_id;
  end if;

  return new;
end;
$$;

create trigger kyc_apply_to_merchant_trigger
after update on public.kyc_submissions
for each row execute function public.kyc_apply_to_merchant();
