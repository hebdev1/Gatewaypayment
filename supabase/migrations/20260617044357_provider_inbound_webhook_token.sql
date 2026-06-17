alter table public.payment_provider_accounts
  add column if not exists inbound_webhook_token_prefix text,
  add column if not exists inbound_webhook_token_hash text,
  add column if not exists inbound_webhook_token_rotated_at timestamptz;

create unique index if not exists payment_provider_accounts_inbound_token_idx
  on public.payment_provider_accounts(inbound_webhook_token_hash)
  where inbound_webhook_token_hash is not null;
