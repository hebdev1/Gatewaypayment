import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard } from "lucide-react";
import { formatMoney } from "@/lib/payments/money";
import { createAdminClient } from "@/lib/supabase/admin";

type CheckoutPayment = {
  id: string;
  merchant_order_id: string;
  status: string;
  amount_gross: string;
  currency: string;
  description: string | null;
  provider_checkout_url: string | null;
  merchants:
    | {
        display_name: string;
      }
    | {
        display_name: string;
      }[]
    | null;
};

function merchantName(payment: CheckoutPayment) {
  if (Array.isArray(payment.merchants)) {
    return payment.merchants[0]?.display_name ?? "Merchant";
  }

  return payment.merchants?.display_name ?? "Merchant";
}

export default async function HostedCheckoutPage({
  params
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const admin = createAdminClient();
  const { data: payment, error } = await admin
    .from("payments")
    .select("id, merchant_order_id, status, amount_gross, currency, description, provider_checkout_url, merchants(display_name)")
    .eq("id", paymentId)
    .maybeSingle();

  if (error || !payment) {
    return (
      <main className="checkout-shell">
        <section className="checkout-panel">
          <h1>Payment unavailable</h1>
          <p className="error">This checkout link is not valid.</p>
        </section>
      </main>
    );
  }

  const row = payment as unknown as CheckoutPayment;
  const paid = row.status === "succeeded";

  return (
    <main className="checkout-shell">
      <section className="checkout-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Hosted checkout</p>
            <h1>{merchantName(row)}</h1>
          </div>
          <div className="brand-mark">
            {paid ? <CheckCircle2 size={18} aria-hidden="true" /> : <CreditCard size={18} aria-hidden="true" />}
          </div>
        </div>

        <div className="checkout-amount">
          <span>Amount</span>
          <strong>{formatMoney(row.amount_gross, row.currency)}</strong>
        </div>
        <div className="checkout-row">
          <span>Order</span>
          <strong className="mono">{row.merchant_order_id}</strong>
        </div>
        <div className="checkout-row">
          <span>Status</span>
          <strong className={`status-pill ${row.status}`}>{row.status}</strong>
        </div>
        {row.description ? <p>{row.description}</p> : null}

        {paid ? (
          <Link className="button full" href={`/checkout/${row.id}/return`}>
            View receipt
          </Link>
        ) : row.provider_checkout_url ? (
          <a className="button full" href={row.provider_checkout_url}>
            Pay with MonCash
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        ) : (
          <p className="error">Payment provider link is not ready.</p>
        )}
      </section>
    </main>
  );
}
