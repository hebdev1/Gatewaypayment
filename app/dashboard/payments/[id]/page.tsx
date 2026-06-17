import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { formatMoney } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";
import { RefundForm } from "./refund-form";
import { markRefundCompletedAction, markRefundFailedAction } from "./actions";

type Payment = {
  id: string;
  merchant_id: string;
  merchant_order_id: string;
  provider: string;
  mode: "sandbox" | "live";
  status: string;
  amount_gross: string;
  refunded_amount: string;
  gateway_fee_amount: string;
  provider_fee_amount: string;
  merchant_net_amount: string;
  currency: string;
  customer_email: string | null;
  customer_phone: string | null;
  description: string | null;
  hosted_checkout_url: string | null;
  provider_checkout_url: string | null;
  provider_order_id: string | null;
  provider_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  fully_refunded_at: string | null;
  metadata: Record<string, unknown> | null;
};

type Event = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type Refund = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  reason: string | null;
  merchant_refund_id: string | null;
  provider_refund_id: string | null;
  created_at: string;
  processed_at: string | null;
};

export default async function PaymentDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { merchant } = await requireMerchant();
  const supabase = await createClient();

  const [{ data: paymentRow }, { data: eventsRows }, { data: refundsRows }] = await Promise.all([
    supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .eq("merchant_id", merchant.id)
      .maybeSingle(),
    supabase
      .from("payment_events")
      .select("id, event_type, payload, created_at")
      .eq("payment_id", id)
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("refunds")
      .select(
        "id, amount, currency, status, reason, merchant_refund_id, provider_refund_id, created_at, processed_at"
      )
      .eq("payment_id", id)
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
  ]);

  if (!paymentRow) {
    notFound();
  }

  const payment = paymentRow as Payment;
  const events = (eventsRows ?? []) as Event[];
  const refunds = (refundsRows ?? []) as Refund[];

  const refundedAmount = Number(payment.refunded_amount ?? 0);
  const gross = Number(payment.amount_gross);
  const remaining = Math.max(0, gross - refundedAmount);
  const canRefund = payment.status === "succeeded" && remaining > 0;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            <Link href="/dashboard/payments">
              <ChevronLeft size={14} aria-hidden="true" /> Payments
            </Link>
          </p>
          <h1 className="mono">{payment.merchant_order_id}</h1>
          <p>{new Date(payment.created_at).toLocaleString()}</p>
        </div>
        <div className="topbar-actions">
          <span className="mode-pill">{payment.mode}</span>
          <span className={`status-pill ${payment.status}`}>{payment.status}</span>
        </div>
      </header>

      <section className="metrics-grid" aria-label="Payment amounts">
        <article className="metric-card">
          <span>Gross</span>
          <strong>{formatMoney(payment.amount_gross, payment.currency)}</strong>
        </article>
        <article className="metric-card">
          <span>Gateway fee</span>
          <strong>{formatMoney(payment.gateway_fee_amount, payment.currency)}</strong>
        </article>
        <article className="metric-card">
          <span>Provider fee</span>
          <strong>{formatMoney(payment.provider_fee_amount, payment.currency)}</strong>
        </article>
        <article className="metric-card">
          <span>Net</span>
          <strong>{formatMoney(payment.merchant_net_amount, payment.currency)}</strong>
        </article>
        <article className="metric-card">
          <span>Refunded</span>
          <strong>{formatMoney(refundedAmount, payment.currency)}</strong>
        </article>
        <article className="metric-card">
          <span>Remaining refundable</span>
          <strong>{formatMoney(remaining, payment.currency)}</strong>
        </article>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Customer &amp; references</h2>
        </div>
        <dl className="kv-grid">
          <div>
            <dt>Customer email</dt>
            <dd>{payment.customer_email ?? "—"}</dd>
          </div>
          <div>
            <dt>Customer phone</dt>
            <dd>{payment.customer_phone ?? "—"}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{payment.description ?? "—"}</dd>
          </div>
          <div>
            <dt>Provider transaction id</dt>
            <dd className="mono">{payment.provider_transaction_id ?? "—"}</dd>
          </div>
          <div>
            <dt>Provider order id</dt>
            <dd className="mono">{payment.provider_order_id ?? "—"}</dd>
          </div>
          <div>
            <dt>Hosted checkout</dt>
            <dd>
              {payment.hosted_checkout_url ? (
                <a href={payment.hosted_checkout_url} className="mono">
                  {payment.hosted_checkout_url}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Refunds</h2>
          <span className="status-pill">{refunds.length} total</span>
        </div>
        {canRefund ? (
          <RefundForm
            paymentId={payment.id}
            currency={payment.currency}
            maxAmount={remaining}
          />
        ) : (
          <p className="notice">
            <RotateCcw size={14} aria-hidden="true" />{" "}
            {payment.status !== "succeeded"
              ? "Only succeeded payments can be refunded."
              : "This payment has been fully refunded."}
          </p>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Provider refund id</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr key={refund.id}>
                  <td>{new Date(refund.created_at).toLocaleString()}</td>
                  <td>{formatMoney(refund.amount, refund.currency)}</td>
                  <td>
                    <span className={`status-pill ${refund.status}`}>{refund.status}</span>
                  </td>
                  <td>{refund.reason ?? "—"}</td>
                  <td className="mono">{refund.provider_refund_id ?? "—"}</td>
                  <td>
                    {(refund.status === "created" || refund.status === "pending") && (
                      <div className="row-actions">
                        <form action={markRefundCompletedAction}>
                          <input type="hidden" name="refund_id" value={refund.id} />
                          <button className="button secondary" type="submit">
                            Mark succeeded
                          </button>
                        </form>
                        <form action={markRefundFailedAction}>
                          <input type="hidden" name="refund_id" value={refund.id} />
                          <button className="button secondary" type="submit">
                            Mark failed
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!refunds.length ? <p className="empty">No refunds for this payment.</p> : null}
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Events</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                  <td>
                    <span className="status-pill">{event.event_type}</span>
                  </td>
                  <td>
                    <details>
                      <summary>view</summary>
                      <pre className="mono small">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!events.length ? <p className="empty">No events yet.</p> : null}
        </div>
      </section>
    </>
  );
}
