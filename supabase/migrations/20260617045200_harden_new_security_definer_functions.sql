revoke execute on function public.enforce_refund_limit() from public, anon, authenticated;
revoke execute on function public.refunds_update_payment_totals() from public, anon, authenticated;
revoke execute on function public.refresh_payment_refund_totals(uuid) from public, anon, authenticated;
revoke execute on function public.kyc_apply_to_merchant() from public, anon, authenticated;
