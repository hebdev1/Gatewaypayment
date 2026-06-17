-- This migration assumes the following Vault secrets have been created
-- out of band (they can't be in source control):
--   - functions_base_url  : the project's functions URL, e.g.
--                           https://<ref>.functions.supabase.co
--   - webhook_dispatcher_secret : random 32-byte secret mirrored as
--                                 DISPATCHER_SECRET in the Edge Function
--                                 environment variables.
--
-- See README.md for the SQL one-liners that bootstrap them.

create or replace function public.dispatch_webhooks_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'functions_base_url'
  order by created_at desc
  limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'webhook_dispatcher_secret'
  order by created_at desc
  limit 1;

  if v_url is null or v_secret is null then
    raise log 'dispatch_webhooks_tick: missing vault secrets, skipping';
    return;
  end if;

  select net.http_post(
    url := v_url || '/dispatch-webhooks',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-internal-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;

  raise log 'dispatch_webhooks_tick: queued pg_net request_id=%', v_request_id;
end;
$$;

revoke execute on function public.dispatch_webhooks_tick() from public;
revoke execute on function public.dispatch_webhooks_tick() from anon;
revoke execute on function public.dispatch_webhooks_tick() from authenticated;

do $$
begin
  perform cron.unschedule('dispatch-webhooks-tick');
exception when others then
  null;
end $$;

select cron.schedule(
  'dispatch-webhooks-tick',
  '* * * * *',
  $cron$select public.dispatch_webhooks_tick();$cron$
);
