import Link from "next/link";
import { Banknote } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { formatMoney } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";

type RefundRow = {
  id: string;
  payment_id: string;
  amount: string;
  currency: string;
  status: string;
  reason: string | null;
  created_at: string;
  payments: {
    merchant_order_id: string;
    mode: string;
  } | null;
};

const PAGE_SIZE = 25;

export default async function RefundsListPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const status = params.status ?? "";

  const { merchant } = await requireMerchant();
  const supabase = await createClient();

  let query = supabase
    .from("refunds")
    .select(
      "id, payment_id, amount, currency, status, reason, created_at, payments(merchant_order_id, mode)",
      { count: "exact" }
    )
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);

  const { data, count } = await query;
  const refunds = (data ?? []) as unknown as RefundRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Activity</p>
          <h1>Refunds</h1>
        </div>
      </header>

      <section className="data-card">
        <form className="filter-row" method="get">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue={status}>
              <option value="">All statuses</option>
              <option value="created">created</option>
              <option value="pending">pending</option>
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
              <option value="canceled">canceled</option>
            </select>
          </div>
          <div className="field">
            <button className="button" type="submit">
              Apply
            </button>
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Order</th>
                <th>Mode</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr key={refund.id}>
                  <td>{new Date(refund.created_at).toLocaleString()}</td>
                  <td className="mono">
                    <Link href={`/dashboard/payments/${refund.payment_id}`}>
                      {refund.payments?.merchant_order_id ?? refund.payment_id}
                    </Link>
                  </td>
                  <td>
                    <span className="mode-pill">{refund.payments?.mode ?? "—"}</span>
                  </td>
                  <td>{formatMoney(refund.amount, refund.currency)}</td>
                  <td>
                    <span className={`status-pill ${refund.status}`}>{refund.status}</span>
                  </td>
                  <td>{refund.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!refunds.length ? (
            <p className="empty">
              <Banknote size={16} aria-hidden="true" /> No refunds yet.
            </p>
          ) : null}
        </div>

        <div className="pager">
          <span>
            Page {page} of {totalPages} — {totalCount} total
          </span>
          <div className="pager-actions">
            {page > 1 ? (
              <Link className="button secondary" href={`/dashboard/refunds?page=${page - 1}`}>
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link className="button secondary" href={`/dashboard/refunds?page=${page + 1}`}>
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
