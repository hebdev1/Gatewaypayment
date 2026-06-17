-- Lock down rls_auto_enable: legitimate Supabase event-trigger helper,
-- but should not be invokable via PostgREST RPC by anon/authenticated.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- Pin search_path on set_updated_at to prevent hijack via session search_path.
alter function public.set_updated_at() set search_path = '';

-- Cover the two foreign keys flagged by the performance linter.
create index if not exists webhook_deliveries_endpoint_id_idx
  on public.webhook_deliveries(endpoint_id);

create index if not exists webhook_deliveries_payment_id_idx
  on public.webhook_deliveries(payment_id)
  where payment_id is not null;
