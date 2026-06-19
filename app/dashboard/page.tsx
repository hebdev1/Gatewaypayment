import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Percent,
  ReceiptText,
  Wallet
} from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { formatMoney } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";
import { AreaChart, Sparkline } from "./_sparkline";

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

type DailyPoint = {
  iso: string;
  label: string;
  gross: number;
  count: number;
};

function buildDailyVolumes(payments: PaymentRow[], days = 30): DailyPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series: DailyPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    series.push({
      iso,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      gross: 0,
      count: 0
    });
  }

  const byIso = new Map(series.map((s) => [s.iso, s]));

  for (const p of payments) {
    if (p.status !== "succeeded") continue;
    const iso = new Date(p.created_at).toISOString().slice(0, 10);
    const point = byIso.get(iso);
    if (point) {
      point.gross += Number(p.amount_gross);
      point.count += 1;
    }
  }

  return series;
}

function percentChange(values: number[]): { value: number; label: string; tone: "positive" | "negative" | "flat" } {
  if (values.length < 2) return { value: 0, label: "—", tone: "flat" };
  const half = Math.floor(values.length / 2);
  const prev = values.slice(0, half).reduce((a, b) => a + b, 0);
  const curr = values.slice(half).reduce((a, b) => a + b, 0);
  if (prev === 0 && curr === 0) return { value: 0, label: "—", tone: "flat" };
  if (prev === 0) return { value: 100, label: "+100%", tone: "positive" };
  const pct = ((curr - prev) / prev) * 100;
  const tone = pct > 0.5 ? "positive" : pct < -0.5 ? "negative" : "flat";
  const sign = pct > 0 ? "+" : "";
  return { value: pct, label: `${sign}${pct.toFixed(1)}%`, tone };
}

export default async function DashboardPage() {
  const { merchant } = await requireMerchant();
  const supabase = await createClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [{ data: summaries }, { data: recentPayments }, { data: rangePayments }, { data: latestKyc }] =
    await Promise.all([
      supabase
        .from("merchant_balance_summary")
        .select("*")
        .eq("merchant_id", merchant.id),
      supabase
        .from("payments")
        .select(
          "id, merchant_order_id, provider, mode, status, amount_gross, gateway_fee_amount, provider_fee_amount, merchant_net_amount, refunded_amount, currency, created_at"
        )
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("payments")
        .select("id, status, amount_gross, currency, created_at")
        .eq("merchant_id", merchant.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true }),
      supabase
        .from("kyc_submissions")
        .select("status")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

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

  const dailySeries = buildDailyVolumes(
    (rangePayments ?? []) as PaymentRow[],
    30
  );

  const sparkValues = dailySeries.map((d) => d.gross);
  const grossDelta = percentChange(sparkValues);
  const countDelta = percentChange(dailySeries.map((d) => d.count));
  const last7Net = (rangePayments ?? [])
    .filter((p) => p.status === "succeeded")
    .reduce((acc, p) => acc + Number(p.amount_gross), 0);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Merchant dashboard</p>
          <h1>Welcome back, {merchant.display_name}</h1>
          <p>Here&apos;s what&apos;s happening across your account.</p>
        </div>
        <div className="topbar-actions">
          <Link className="button secondary" href="/dashboard/payments">
            All payments
          </Link>
          <Link className="button" href="/dashboard/api-keys">
            New API key
          </Link>
        </div>
      </header>

      {!merchant.live_enabled ? (
        <p className="notice" style={{ marginBottom: 20 }}>
          <strong>Live mode is locked.</strong>{" "}
          {latestKyc?.status === "submitted" ? (
            <>Your KYC submission is under review. We&apos;ll email you when it&apos;s approved.</>
          ) : (
            <>
              Complete the <Link href="/dashboard/kyc">KYC verification</Link> to unlock live
              payments.
            </>
          )}
        </p>
      ) : null}

      <section className="metrics-grid" aria-label="Payment metrics">
        <article className="metric-card">
          <div className="label-row">
            <span>Gross volume</span>
            <span className="metric-icon"><CircleDollarSign size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">
            {formatMoney(totals.gross, merchant.default_currency)}
            <span className={`delta ${grossDelta.tone}`}>
              {grossDelta.tone === "positive" ? <ArrowUpRight size={11} aria-hidden="true" /> : null}
              {grossDelta.tone === "negative" ? <ArrowDownRight size={11} aria-hidden="true" /> : null}
              {grossDelta.label}
            </span>
          </div>
          <p className="sub">Last 30 days vs. prior period</p>
          <div className="sparkline">
            <Sparkline values={sparkValues} />
          </div>
        </article>

        <article className="metric-card">
          <div className="label-row">
            <span>Successful payments</span>
            <span className="metric-icon"><ReceiptText size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">
            {totals.count.toLocaleString()}
            <span className={`delta ${countDelta.tone}`}>
              {countDelta.tone === "positive" ? <ArrowUpRight size={11} aria-hidden="true" /> : null}
              {countDelta.tone === "negative" ? <ArrowDownRight size={11} aria-hidden="true" /> : null}
              {countDelta.label}
            </span>
          </div>
          <p className="sub">All-time succeeded</p>
        </article>

        <article className="metric-card">
          <div className="label-row">
            <span>Gateway fees</span>
            <span className="metric-icon"><Percent size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">{formatMoney(totals.gatewayFees, merchant.default_currency)}</div>
          <p className="sub">2.5% of every successful payment</p>
        </article>

        <article className="metric-card">
          <div className="label-row">
            <span>Net balance</span>
            <span className="metric-icon"><Wallet size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">{formatMoney(totals.net, merchant.default_currency)}</div>
          <p className="sub">Owed to you after fees</p>
        </article>
      </section>

      <section className="chart-card">
        <div className="chart-card-head">
          <div>
            <p className="eyebrow">Last 30 days</p>
            <h2>Payment volume</h2>
          </div>
          <div className="chart-legend">
            <span>
              <span className="dot" style={{ background: "var(--accent)" }} />
              Gross volume
            </span>
            <span className="muted">
              7-day sum: {formatMoney(last7Net, merchant.default_currency)}
            </span>
          </div>
        </div>
        <div className="chart-canvas">
          <AreaChart
            values={dailySeries.map((d) => d.gross)}
            xLabels={dailySeries.map((d) => d.label)}
            height={220}
          />
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Recent payments</h2>
          <Link className="button ghost" href="/dashboard/payments">
            View all →
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Refunded</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(recentPayments as PaymentRow[] | null)?.map((payment) => (
                <tr key={payment.id}>
                  <td className="mono">
                    <Link href={`/dashboard/payments/${payment.id}`}>
                      {payment.merchant_order_id}
                    </Link>
                  </td>
                  <td>
                    <span className="mode-pill">{payment.mode}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${payment.status}`}>{payment.status}</span>
                  </td>
                  <td>{formatMoney(payment.amount_gross, payment.currency)}</td>
                  <td>{formatMoney(payment.merchant_net_amount, payment.currency)}</td>
                  <td>
                    {Number(payment.refunded_amount) > 0
                      ? formatMoney(payment.refunded_amount, payment.currency)
                      : "—"}
                  </td>
                  <td>{new Date(payment.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recentPayments?.length ? (
            <p className="empty">
              <Banknote size={16} aria-hidden="true" /> No payments yet. Generate an API key to get started.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
