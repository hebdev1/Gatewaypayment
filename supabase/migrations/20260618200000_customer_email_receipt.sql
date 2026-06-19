-- KYC documents storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

-- Extend payment.succeeded email trigger to also email the customer
-- when customer_email is set on the payment.
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
  v_customer_subject text;
  v_customer_html text;
  v_display_amount text;
begin
  if new.status = 'succeeded'
    and (tg_op = 'INSERT' or old.status is distinct from 'succeeded') then

    select m.id, m.email, m.display_name, m.default_currency, u.email as owner_email
    into v_merchant
    from public.merchants m
    left join auth.users u on u.id = m.owner_user_id
    where m.id = new.merchant_id;

    if v_merchant.id is null then
      return new;
    end if;

    if new.display_amount is not null and new.display_currency is not null then
      v_display_amount := new.display_amount || ' ' || new.display_currency
                          || ' (≈ ' || new.amount_gross || ' ' || new.currency || ')';
    else
      v_display_amount := new.amount_gross || ' ' || new.currency;
    end if;

    -- Merchant email
    if coalesce(v_merchant.email, v_merchant.owner_email) is not null then
      v_subject := format('Payment received: %s · %s',
        v_display_amount, coalesce(new.merchant_order_id, new.id::text));

      v_html := format(
        $html$<div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #0b1220;">
          <h2 style="margin: 0 0 8px;">Payment received</h2>
          <p style="color: #475467;">Hi %s, you just got paid through HaitiPay.</p>
          <div style="background: #f5f6fa; border-radius: 12px; padding: 16px;">
            <div style="color: #475467; font-size: 13px;">Amount</div>
            <div style="font-size: 26px; font-weight: 700;">%s</div>
          </div>
          <div style="background: #f5f6fa; border-radius: 12px; padding: 12px 16px; font-size: 14px; margin-top: 8px;">
            <div><strong>Order:</strong> %s</div>
            <div><strong>Net to you:</strong> %s %s</div>
            <div><strong>Provider:</strong> %s · %s mode</div>
          </div>
        </div>$html$,
        v_merchant.display_name, v_display_amount, coalesce(new.merchant_order_id, new.id::text),
        new.merchant_net_amount, new.currency, new.provider, new.mode
      );

      perform public.queue_email(
        v_merchant.id, coalesce(v_merchant.email, v_merchant.owner_email),
        v_subject, v_html, null, 'payment.succeeded.merchant',
        jsonb_build_object('payment_id', new.id, 'amount', new.amount_gross, 'currency', new.currency)
      );
    end if;

    -- Customer receipt
    if new.customer_email is not null and new.customer_email <> '' then
      v_customer_subject := format('Receipt from %s — %s', v_merchant.display_name, v_display_amount);

      v_customer_html := format(
        $html$<div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #0b1220;">
          <h2 style="margin: 0 0 8px;">Thanks for your payment</h2>
          <p style="color: #475467;">Your payment to %s was received successfully.</p>
          <div style="background: #f5f6fa; border-radius: 12px; padding: 16px;">
            <div style="color: #475467; font-size: 13px;">Amount paid</div>
            <div style="font-size: 26px; font-weight: 700;">%s</div>
          </div>
          <div style="background: #f5f6fa; border-radius: 12px; padding: 12px 16px; font-size: 14px; margin-top: 8px;">
            <div><strong>Reference:</strong> %s</div>
            <div><strong>Paid at:</strong> %s</div>
            <div><strong>Method:</strong> %s</div>
          </div>
          %s
        </div>$html$,
        v_merchant.display_name, v_display_amount, coalesce(new.merchant_order_id, new.id::text),
        coalesce(new.paid_at, now()), upper(new.provider::text),
        case when new.description is not null then format('<p style="margin: 14px 0; color: #475467;">%s</p>', new.description) else '' end
      );

      perform public.queue_email(
        v_merchant.id, new.customer_email,
        v_customer_subject, v_customer_html, null, 'payment.succeeded.customer',
        jsonb_build_object('payment_id', new.id, 'amount', new.amount_gross, 'currency', new.currency)
      );
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.on_payment_succeeded_email() from public, anon, authenticated;
