import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = {
  id: string;
  merchant_id: string;
  merchant_order_id: string;
  status: string;
  mode: string;
  amount_gross: string;
  currency: string;
  refunded_amount: string;
  created_at: string;
  merchants: { display_name: string } | null;
};

const PAGE_SIZE = 50;

export default async function AdminPaymentsPage({
  searchParams
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    mode?: string;
    q?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const status = params.status ?? "";
  const mode = params.mode ?? "";
  const search = (params.q ?? "").trim();

  const admin = createAdminClient();
  let query = admin
    .from("payments")
    .select(
      "id, merchant_id, merchant_order_id, status, mode, amount_gross, currency, refunded_amount, created_at, merchants(display_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (mode) query = query.eq("mode", mode);
  if (search) query = query.ilike("merchant_order_id", `%${search}%`);

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Activity</p>
          <h1>All payments</h1>
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
              defaultValue={search}
              placeholder="Search"
            />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue={status}>
              <option value="">Any</option>
              <option value="created">created</option>
              <option value="pending">pending</option>
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
              <option value="canceled">canceled</option>
              <option value="expired">expired</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="mode">Mode</label>
            <select className="input" id="mode" name="mode" defaultValue={mode}>
              <option value="">Any</option>
              <option value="sandbox">sandbox</option>
              <option value="live">live</option>
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
                <th>Merchant</th>
                <th>Order</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Gross</th>
                <th>Refunded</th>
                <th>Currency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>
                    <Link href={`/admin/merchants/${row.merchant_id}`}>
                      {row.merchants?.display_name ?? row.merchant_id}
                    </Link>
                  </td>
                  <td className="mono">{row.merchant_order_id}</td>
                  <td>
                    <span className="mode-pill">{row.mode}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${row.status}`}>{row.status}</span>
                  </td>
                  <td>{row.amount_gross}</td>
                  <td>{Number(row.refunded_amount) > 0 ? row.refunded_amount : "—"}</td>
                  <td>{row.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="empty">No payments yet.</p> : null}
        </div>

        <div className="pager">
          <span>
            Page {page} of {totalPages} — {totalCount} total
          </span>
        </div>
      </section>
    </>
  );
}
