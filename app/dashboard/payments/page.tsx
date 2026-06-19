import Link from "next/link";
import { Banknote } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { formatMoney } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";

type PaymentRow = {
  id: string;
  merchant_order_id: string;
  provider: string;
  mode: "sandbox" | "live";
  status: string;
  amount_gross: string;
  refunded_amount: string;
  currency: string;
  created_at: string;
};

const PAGE_SIZE = 25;

const STATUSES = [
  "created",
  "pending",
  "succeeded",
  "failed",
  "canceled",
  "expired"
] as const;

const MODES = ["sandbox", "live"] as const;

export default async function PaymentsListPage({
  searchParams
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    mode?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;
  const mode = MODES.includes(params.mode as (typeof MODES)[number])
    ? (params.mode as (typeof MODES)[number])
    : undefined;
  const search = (params.q ?? "").trim();

  const { merchant } = await requireMerchant();
  const supabase = await createClient();

  let query = supabase
    .from("payments")
    .select(
      "id, merchant_order_id, provider, mode, status, amount_gross, refunded_amount, currency, created_at",
      { count: "exact" }
    )
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (mode) query = query.eq("mode", mode);
  if (search) query = query.ilike("merchant_order_id", `%${search}%`);

  const { data, count } = await query;
  const payments = (data ?? []) as PaymentRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const baseHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (mode) next.set("mode", mode);
    if (search) next.set("q", search);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/dashboard/payments?${qs}` : "/dashboard/payments";
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Activity</p>
          <h1>Payments</h1>
        </div>
        <div className="topbar-actions">
          <a
            className="button secondary"
            href={`/api/exports/payments?${new URLSearchParams({
              ...(status ? { status } : {}),
              ...(mode ? { mode } : {})
            }).toString()}`}
          >
            Export CSV
          </a>
        </div>
      </header>

      <section className="data-card">
        <form className="filter-row" method="get">
          <div className="field">
            <label htmlFor="q">Order ID</label>
            <input
              className="input"
              id="q"
              name="q"
              type="search"
              placeholder="Search by merchant order id"
              defaultValue={search}
            />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mode">Mode</label>
            <select className="input" id="mode" name="mode" defaultValue={mode ?? ""}>
              <option value="">All modes</option>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
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
                <th>Order</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Gross</th>
                <th>Refunded</th>
                <th>Currency</th>
                <th>Provider</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
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
                  <td>
                    {Number(payment.refunded_amount) > 0
                      ? formatMoney(payment.refunded_amount, payment.currency)
                      : "—"}
                  </td>
                  <td>{payment.currency}</td>
                  <td>{payment.provider}</td>
                  <td>{new Date(payment.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!payments.length ? (
            <p className="empty">
              <Banknote size={16} aria-hidden="true" /> No payments match these filters.
            </p>
          ) : null}
        </div>

        <div className="pager">
          <span>
            Page {page} of {totalPages} — {totalCount} total
          </span>
          <div className="pager-actions">
            {page > 1 ? (
              <Link className="button secondary" href={baseHref({ page: String(page - 1) })}>
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link className="button secondary" href={baseHref({ page: String(page + 1) })}>
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
