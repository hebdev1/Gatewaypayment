import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard } from "lucide-react";
import { formatMoney } from "@/lib/payments/money";
import { getT } from "@/lib/i18n";
import { LocaleSwitcher } from "@/app/_locale-switcher";
import { createAdminClient } from "@/lib/supabase/admin";

type CheckoutPayment = {
  id: string;
  merchant_order_id: string;
  status: string;
  amount_gross: string;
  currency: string;
  display_amount: string | null;
  display_currency: string | null;
  description: string | null;
  provider_checkout_url: string | null;
  merchants:
    | { display_name: string }
    | { display_name: string }[]
    | null;
};

function merchantName(payment: CheckoutPayment) {
  if (Array.isArray(payment.merchants)) {
    return payment.merchants[0]?.display_name ?? "Merchant";
  }
  return payment.merchants?.display_name ?? "Merchant";
}

export default async function HostedCheckoutPage({
  params,
  searchParams
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { paymentId } = await params;
  const search = await searchParams;
  const { locale, t } = await getT(new URLSearchParams(search as Record<string, string>));
  const admin = createAdminClient();
  const { data: payment, error } = await admin
    .from("payments")
    .select(
      "id, merchant_order_id, status, amount_gross, currency, display_amount, display_currency, description, provider_checkout_url, merchants(display_name)"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error || !payment) {
    return (
      <main className="checkout-shell">
        <section className="checkout-panel">
          <h1>{t("checkout.unavailable.title")}</h1>
          <p className="error">{t("checkout.unavailable.invalid")}</p>
        </section>
      </main>
    );
  }

  const row = payment as unknown as CheckoutPayment;
  const paid = row.status === "succeeded";
  const showCurrency = row.display_currency ?? row.currency;
  const showAmount = row.display_amount ?? row.amount_gross;

  return (
    <main className="checkout-shell">
      <section className="checkout-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">{t("checkout.eyebrow")}</p>
            <h1>{merchantName(row)}</h1>
          </div>
          <div className="brand-mark">
            {paid ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <CreditCard size={18} aria-hidden="true" />
            )}
          </div>
        </div>

        <div className="checkout-amount">
          <span>{t("common.amount")}</span>
          <strong>{formatMoney(showAmount, showCurrency)}</strong>
        </div>
        <div className="checkout-row">
          <span>{t("checkout.order")}</span>
          <strong className="mono">{row.merchant_order_id}</strong>
        </div>
        <div className="checkout-row">
          <span>{t("checkout.status")}</span>
          <strong className={`status-pill ${row.status}`}>{row.status}</strong>
        </div>
        {row.description ? <p>{row.description}</p> : null}

        {paid ? (
          <Link className="button full" href={`/checkout/${row.id}/return`}>
            {t("checkout.viewReceipt")}
          </Link>
        ) : row.provider_checkout_url ? (
          <a className="button full" href={row.provider_checkout_url}>
            {t("checkout.pay.moncash")}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        ) : (
          <p className="error">{t("checkout.notReady")}</p>
        )}

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <LocaleSwitcher current={locale} next={`/checkout/${row.id}`} />
        </div>
      </section>
    </main>
  );
}
