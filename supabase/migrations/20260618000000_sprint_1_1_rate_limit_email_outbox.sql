-- Sprint 1.1 — rate limiting + email outbox + payment notification trigger

-- Rate limiting buckets (per-api-key, 1-minute window)
create table public.rate_limit_buckets (
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (api_key_id, window_start)
);

create index rate_limit_recent_idx on public.rate_limit_buckets(window_start);

alter table public.rate_limit_buckets enable row level security;
grant select on public.rate_limit_buckets to authenticated;
grant all on public.rate_limit_buckets to service_role;
revoke all on public.rate_limit_buckets from anon;

create or replace function public.rate_limit_hit(p_api_key_id uuid, p_window timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_new_count integer;
begin
  insert into public.rate_limit_buckets (api_key_id, window_start, request_count)
  values (p_api_key_id, p_window, 1)
  on conflict (api_key_id, window_start) do update
  set request_count = public.rate_limit_buckets.request_count + 1
  returning request_count into v_new_count;
  return v_new_count;
end;
$$;

revoke execute on function public.rate_limit_hit(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.rate_limit_cleanup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.rate_limit_buckets
  where window_start < now() - interval '24 hours';
end;
$$;

revoke execute on function public.rate_limit_cleanup() from public, anon, authenticated;

-- Email outbox
create type public.email_status as enum ('pending', 'sending', 'sent', 'failed');

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  to_address text not null,
  reply_to text,
  subject text not null,
  body_html text not null,
  body_text text,
  template_key text,
  template_data jsonb not null default '{}'::jsonb,
  status public.email_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_outbox_pending_idx on public.email_outbox(send_at, status)
  where status in ('pending', 'failed') and attempts < 5;
create index email_outbox_merchant_idx on public.email_outbox(merchant_id, created_at desc);

alter table public.email_outbox enable row level security;

create policy "members can read their merchant emails"
on public.email_outbox
for select
to authenticated
using (merchant_id is null or public.is_merchant_member(merchant_id));

create policy "admins can read all emails"
on public.email_outbox
for select
to authenticated
using (public.is_app_admin());

grant select on public.email_outbox to authenticated;
grant all on public.email_outbox to service_role;
revoke all on public.email_outbox from anon;

create or replace function public.queue_email(
  p_merchant_id uuid, p_to text, p_subject text, p_body_html text,
  p_body_text text default null, p_template_key text default null,
  p_template_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.email_outbox (merchant_id, to_address, subject, body_html, body_text, template_key, template_data)
  values (p_merchant_id, p_to, p_subject, p_body_html, p_body_text, p_template_key, p_template_data)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.queue_email(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;

-- Trigger: queue payment.succeeded email
create or replace function public.on_payment_succeeded_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant record;
  v_subject text;
  v_html text;
begin
  if new.status = 'succeeded'
    and (tg_op = 'INSERT' or old.status is distinct from 'succeeded') then

    select m.id, m.email, m.display_name, m.default_currency, u.email as owner_email
    into v_merchant
    from public.merchants m
    left join auth.users u on u.id = m.owner_user_id
    where m.id = new.merchant_id;

    if v_merchant.id is null then return new; end if;
    if coalesce(v_merchant.email, v_merchant.owner_email) is null then return new; end if;

    v_subject := format('Payment received: %s %s · %s',
      new.amount_gross, new.currency, coalesce(new.merchant_order_id, new.id::text));

    v_html := format(
      $html$<div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #0b1220;">
        <h2 style="margin: 0 0 8px;">Payment received</h2>
        <p style="color: #475467; margin: 0 0 16px;">Hi %s, you just got paid through HaitiPay.</p>
        <div style="background: #f5f6fa; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
          <div style="color: #475467; font-size: 13px;">Amount</div>
          <div style="font-size: 28px; font-weight: 700;">%s %s</div>
        </div>
        <div style="background: #f5f6fa; border-radius: 12px; padding: 12px 16px; font-size: 14px;">
          <div><strong>Order:</strong> %s</div>
          <div><strong>Net to you:</strong> %s %s</div>
          <div><strong>Provider:</strong> %s · %s mode</div>
        </div>
      </div>$html$,
      v_merchant.display_name, new.amount_gross, new.currency,
      coalesce(new.merchant_order_id, new.id::text), new.merchant_net_amount, new.currency,
      new.provider, new.mode
    );

    perform public.queue_email(
      v_merchant.id,
      coalesce(v_merchant.email, v_merchant.owner_email),
      v_subject, v_html, null, 'payment.succeeded',
      jsonb_build_object('payment_id', new.id, 'amount', new.amount_gross, 'currency', new.currency)
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.on_payment_succeeded_email() from public, anon, authenticated;

create trigger payment_succeeded_email_trigger
after insert or update on public.payments
for each row execute function public.on_payment_succeeded_email();

-- Cron job for sending the outbox
create or replace function public.send_emails_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'functions_base_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_sender_secret' order by created_at desc limit 1;
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url || '/send-emails',
    headers := jsonb_build_object('content-type', 'application/json', 'x-internal-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke execute on function public.send_emails_tick() from public, anon, authenticated;

-- Schedule (idempotent)
do $$
begin perform cron.unschedule('send-emails-tick'); exception when others then null; end $$;
select cron.schedule('send-emails-tick', '* * * * *', $cron$select public.send_emails_tick();$cron$);

do $$
begin perform cron.unschedule('rate-limit-cleanup'); exception when others then null; end $$;
select cron.schedule('rate-limit-cleanup', '17 * * * *', $cron$select public.rate_limit_cleanup();$cron$);
