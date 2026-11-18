create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 4 and 120),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  status text not null default 'received' check (status in ('received', 'in_review', 'resolved')),
  created_at timestamptz not null default now()
);

create index support_requests_user_created_idx on public.support_requests (user_id, created_at desc);

alter table public.support_requests enable row level security;
revoke all on public.support_requests from public, anon, authenticated;
grant select on public.support_requests to authenticated;
grant insert (id, subject, message) on public.support_requests to authenticated;

create policy support_requests_read_own on public.support_requests
  for select to authenticated using (user_id = (select auth.uid()));

create policy support_requests_create_own on public.support_requests
  for insert to authenticated with check (user_id = (select auth.uid()));
