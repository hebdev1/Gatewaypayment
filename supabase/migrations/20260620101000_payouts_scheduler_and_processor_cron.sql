-- Scheduler (SQL-only) and processor (HTTP via pg_net) for Model A payouts.

create or replace function public.schedule_payouts_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today_dow smallint := extract(dow from now())::smallint;
  v_today_dom smallint := extract(day from now())::smallint;
  rec record;
  v_available numeric;
  v_destination record;
begin
  for rec in
    select id, payout_schedule, payout_day_of_week, payout_day_of_month, payout_min_amount, default_currency
    from public.merchants
    where auto_payouts_enabled = true and status = 'active' and live_enabled = true
  loop
    if rec.payout_schedule = 'manual_only' then continue;
    elsif rec.payout_schedule = 'daily' then null;
    elsif rec.payout_schedule = 'weekly' and rec.payout_day_of_week = v_today_dow then null;
    elsif rec.payout_schedule = 'monthly' and rec.payout_day_of_month = v_today_dom then null;
    else continue;
    end if;

    if exists (
      select 1 from public.payouts
      where merchant_id = rec.id and mode = 'live'
        and status in ('scheduled', 'pending', 'processing', 'awaiting_manual')
        and created_at::date = (now() at time zone 'UTC')::date
    ) then continue; end if;

    select id, type, moncash_phone, bank_name, bank_account_number, bank_account_holder, nickname
    into v_destination
    from public.payout_destinations
    where merchant_id = rec.id and mode = 'live' and is_default = true and archived_at is null
    limit 1;

    if v_destination.id is null then continue; end if;

    select coalesce(available_amount, 0) into v_available
    from public.merchant_available_balance
    where merchant_id = rec.id and mode = 'live';

    if coalesce(v_available, 0) < rec.payout_min_amount then continue; end if;

    insert into public.payouts (
      merchant_id, mode, destination_id, destination_snapshot,
      amount_gross, provider_fee, amount_net, currency, status, scheduled_for
    ) values (
      rec.id, 'live', v_destination.id,
      jsonb_build_object(
        'type', v_destination.type,
        'moncash_phone', v_destination.moncash_phone,
        'bank_name', v_destination.bank_name,
        'bank_account_number', v_destination.bank_account_number,
        'bank_account_holder', v_destination.bank_account_holder,
        'nickname', v_destination.nickname
      ),
      v_available, 0, v_available, rec.default_currency, 'pending', now()
    );
  end loop;
end;
$$;

revoke execute on function public.schedule_payouts_tick() from public, anon, authenticated;

create or replace function public.process_payouts_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'functions_base_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'payouts_processor_secret' order by created_at desc limit 1;
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url || '/process-payouts',
    headers := jsonb_build_object('content-type', 'application/json', 'x-internal-secret', v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.process_payouts_tick() from public, anon, authenticated;

do $$ begin perform cron.unschedule('schedule-payouts-tick'); exception when others then null; end $$;
select cron.schedule('schedule-payouts-tick', '0 7 * * *', $cron$select public.schedule_payouts_tick();$cron$);

do $$ begin perform cron.unschedule('process-payouts-tick'); exception when others then null; end $$;
select cron.schedule('process-payouts-tick', '*/5 * * * *', $cron$select public.process_payouts_tick();$cron$);
