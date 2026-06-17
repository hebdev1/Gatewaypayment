import { ArrowUpRight, Banknote, CircleDollarSign, Percent, ReceiptText, Wallet } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { formatMoney } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";

import Link from "next/link";

type PaymentRow = {
  id: string;
  merchant_order_id: string;
  provider: string;
  mode: "sandbox" | "live";
  status: string;
  amount_gross: string;
  gateway_fee_amount: string;
  provider_fee_amount: string;
  merchant_net_amount: string;
  refunded_amount: string;
  currency: string;
  created_at: string;
};

export default async function DashboardPage() {
  const { merchant } = await requireMerchant();
  const supabase = await createClient();

  const [{ data: summaries }, { data: payments }] = await Promise.all([
    supabase
      .from("merchant_balance_summary")
      .select("*")
      .eq("merchant_id", merchant.id),
    supabase
      .from("payments")
      .select(
        "id, merchant_order_id, provider, mode, status, amount_gross, gateway_fee_amount, provider_fee_amount, merchant_net_amount, currency, created_at"
      )
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  const { data: latestKyc } = await supabase
    .from("kyc_submissions")
    .select("status")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const totals = (summaries ?? []).reduce(
    (acc, row) => ({
      count: acc.count + Number(row.successful_payment_count ?? 0),
      gross: acc.gross + Number(row.gross_volume ?? 0),
      gatewayFees: acc.gatewayFees + Number(row.gateway_fees ?? 0),
      providerFees: acc.providerFees + Number(row.provider_fees ?? 0),
      net: acc.net + Number(row.merchant_net_balance ?? 0)
    }),
    { count: 0, gross: 0, gatewayFees: 0, providerFees: 0, net: 0 }
  );

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Merchant dashboard</p>
          <h1>Transactions</h1>
          <p>{merchant.live_enabled ? "Sandbox and live modes enabled" : "Sandbox mode enabled"}</p>
        </div>
        <div className="topbar-actions">
          <span className="mode-pill">{merchant.live_enabled ? "sandbox + live" : "sandbox"}</span>
          <span className={`status-pill ${merchant.status}`}>{merchant.status}</span>
        </div>
      </header>

      {!merchant.live_enabled ? (
        <section className="notice" style={{ marginBottom: 18 }}>
          <strong>Live mode is locked.</strong>{" "}
          {latestKyc?.status === "submitted" ? (
            <>Your KYC submission is under review. We&apos;ll email you when it&apos;s approved.</>
          ) : (
            <>
              Complete the <a href="/dashboard/kyc">KYC verification</a> to unlock live
              payments.
            </>
          )}
        </section>
      ) : null}

      <section className="metrics-grid" aria-label="Payment metrics">
        <article className="metric-card">
          <span>
            <span className="metric-icon"><CircleDollarSign size={15} aria-hidden="true" /></span>
            Gross volume
          </span>
          <strong>{formatMoney(totals.gross, merchant.default_currency)}</strong>
        </article>
        <article className="metric-card">
          <span>
            <span className="metric-icon"><Percent size={15} aria-hidden="true" /></span>
            Gateway fees
          </span>
          <strong>{formatMoney(totals.gatewayFees, merchant.default_currency)}</strong>
        </article>
        <article className="metric-card">
          <span>
            <span className="metric-icon"><ReceiptText size={15} aria-hidden="true" /></span>
            Provider fees
          </span>
          <strong>{formatMoney(totals.providerFees, merchant.default_currency)}</strong>
        </article>
        <article className="metric-card">
          <span>
            <span className="metric-icon"><Wallet size={15} aria-hidden="true" /></span>
            Net balance
          </span>
          <strong>{formatMoney(totals.net, merchant.default_currency)}</strong>
        </article>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Recent payments</h2>
          <div aria-hidden="true" className="status-pill">
            {totals.count} paid
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Gross</th>
                <th>Gateway fee</th>
                <th>Provider fee</th>
                <th>Net</th>
                <th>Refunded</th>
                <th>Provider</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(payments as PaymentRow[] | null)?.map((payment) => (
                <tr key={payment.id}>
                  <td className="mono">
                    <Link href={`/dashboard/payments/${payment.id}`}>
                      {payment.merchant_order_id}
                    </Link>
                  </td>
                  <td><span className="mode-pill">{payment.mode}</span></td>
                  <td>
                    <span className={`status-pill ${payment.status}`}>{payment.status}</span>
                  </td>
                  <td>{formatMoney(payment.amount_gross, payment.currency)}</td>
                  <td>{formatMoney(payment.gateway_fee_amount, payment.currency)}</td>
                  <td>{formatMoney(payment.provider_fee_amount, payment.currency)}</td>
                  <td>{formatMoney(payment.merchant_net_amount, payment.currency)}</td>
                  <td>
                    {Number(payment.refunded_amount) > 0
                      ? formatMoney(payment.refunded_amount, payment.currency)
                      : "—"}
                  </td>
                  <td>{payment.provider}</td>
                  <td>{new Date(payment.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!payments?.length ? (
            <p className="empty"><Banknote size={16} aria-hidden="true" /> No payments yet.</p>
          ) : null}
        </div>
      </section>

      <section className="metrics-grid" style={{ marginTop: 18 }}>
        <article className="metric-card">
          <span>
            <span className="metric-icon"><Percent size={15} aria-hidden="true" /></span>
            Gateway rate
          </span>
          <strong>2.5%</strong>
        </article>
        <article className="metric-card">
          <span>
            <span className="metric-icon"><Wallet size={15} aria-hidden="true" /></span>
            Settlement currency
          </span>
          <strong>{merchant.default_currency}</strong>
        </article>
        <article className="metric-card">
          <span>
            <span className="metric-icon"><ArrowUpRight size={15} aria-hidden="true" /></span>
            First provider
          </span>
          <strong>MonCash</strong>
        </article>
      </section>
    </>
  );
}
