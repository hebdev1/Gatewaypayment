create schema if not exists app_private;

revoke all on schema app_private from public;
revoke all on schema app_private from anon;
revoke all on schema app_private from authenticated;

create or replace function app_private.is_merchant_owner(target_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.merchants m
    where m.id = target_merchant_id
      and m.owner_user_id = (select auth.uid())
  );
$$;

create or replace function app_private.is_merchant_member(target_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.is_merchant_owner(target_merchant_id)
  or exists (
    select 1
    from public.merchant_members mm
    where mm.merchant_id = target_merchant_id
      and mm.user_id = (select auth.uid())
  );
$$;

revoke all on function app_private.is_merchant_owner(uuid) from public;
revoke all on function app_private.is_merchant_member(uuid) from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_merchant_owner(uuid) to authenticated;
grant execute on function app_private.is_merchant_member(uuid) to authenticated;
grant usage on schema app_private to service_role;
grant execute on function app_private.is_merchant_owner(uuid) to service_role;
grant execute on function app_private.is_merchant_member(uuid) to service_role;

create or replace function public.is_merchant_member(target_merchant_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.is_merchant_member(target_merchant_id);
$$;

revoke all on function public.is_merchant_member(uuid) from public;
grant execute on function public.is_merchant_member(uuid) to authenticated;
grant execute on function public.is_merchant_member(uuid) to service_role;

drop policy if exists "members can view their merchants" on public.merchants;
create policy "members can view their merchants"
on public.merchants
for select
to authenticated
using (app_private.is_merchant_member(id));

drop policy if exists "members can view own membership" on public.merchant_members;
create policy "members can view own membership"
on public.merchant_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or app_private.is_merchant_owner(merchant_id)
);

drop policy if exists "owners can add themselves as first member" on public.merchant_members;
create policy "owners can add themselves as first member"
on public.merchant_members
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'owner'
  and app_private.is_merchant_owner(merchant_id)
);
