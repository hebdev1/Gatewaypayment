-- Drop the Fee Collection system. Project pivoted to Model A (Settlement):
-- customer pays HaitiPay master wallet, HaitiPay keeps 2.5%, pays merchant
-- the net via Payouts. No need to pull fees from merchant.

drop trigger if exists queue_fee_collection_trigger on public.payments;
drop trigger if exists fee_collection_payment_sync_trigger on public.fee_collections;
drop trigger if exists create_debt_on_failure_trigger on public.fee_collections;
drop trigger if exists merchant_debt_total_sync_trigger on public.merchant_debts;

drop function if exists public.queue_fee_collection_on_payment_success();
drop function if exists public.update_payment_fee_status();
drop function if exists public.create_debt_on_fee_collection_failure();
drop function if exists public.update_merchant_debt_total();

drop table if exists public.merchant_debts;
drop table if exists public.fee_collections;

drop type if exists public.fee_collection_status;
drop type if exists public.merchant_debt_status;

alter table public.merchants
  drop column if exists auto_fee_collection_enabled,
  drop column if exists total_debt_amount,
  drop column if exists fee_collection_consent_at;

alter table public.payments
  drop column if exists fee_collection_status,
  drop column if exists fee_collected_at;
