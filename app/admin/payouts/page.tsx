import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { markPayoutCompletedAction, retryPayoutAction } from "./actions";

type Row = {
  id: string;
  merchant_id: string;
  mode: string;
  amount_gross: string;
  amount_net: string;
  currency: string;
  status: string;
  attempts: number;
  last_error: string | null;
  scheduled_for: string;
  completed_at: string | null;
  created_at: string;
  destination_snapshot: { type?: string; moncash_phone?: string; bank_name?: string };
  merchants: { display_name: string } | null;
};

export default async function AdminPayoutsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = params.status ?? "awaiting_manual";
  const admin = createAdminClient();

  const { data } = await admin
    .from("payouts")
    .select(
      "id, merchant_id, mode, amount_gross, amount_net, currency, status, attempts, last_error, scheduled_for, completed_at, created_at, destination_snapshot, merchants(display_name)"
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Settlement ops</p>
          <h1>Payouts queue</h1>
        </div>
      </header>

      <section className="data-card">
        <form className="filter-row" method="get">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue={status}>
              <option value="awaiting_manual">awaiting_manual</option>
              <option value="pending">pending</option>
              <option value="processing">processing</option>
              <option value="failed">failed</option>
              <option value="succeeded">succeeded</option>
              <option value="canceled">canceled</option>
            </select>
          </div>
          <div className="field">
            <button className="button" type="submit">
              Filter
            </button>
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Merchant</th>
                <th>Mode</th>
                <th>Destination</th>
                <th>Net</th>
                <th>Attempts</th>
                <th>Last error</th>
                <th></th>
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
                  <td><span className="mode-pill">{row.mode}</span></td>
                  <td className="mono small">
                    {row.destination_snapshot?.type === "moncash"
                      ? `MonCash ${row.destination_snapshot.moncash_phone}`
                      : row.destination_snapshot?.bank_name
                      ? `Bank ${row.destination_snapshot.bank_name}`
                      : row.destination_snapshot?.type}
                  </td>
                  <td>{row.amount_net} {row.currency}</td>
                  <td>{row.attempts}</td>
                  <td className="mono small">
                    {row.last_error ? (
                      <details>
                        <summary>view</summary>
                        <pre>{row.last_error}</pre>
                      </details>
                    ) : "—"}
                  </td>
                  <td>
                    <div className="row-actions">
                      {row.status === "awaiting_manual" ? (
                        <form action={markPayoutCompletedAction}>
                          <input type="hidden" name="payout_id" value={row.id} />
                          <input
                            className="input"
                            name="manual_reference"
                            placeholder="Reference (e.g. bank wire id)"
                            style={{ minHeight: 30, padding: "4px 8px" }}
                            required
                          />
                          <button className="button" type="submit">Mark paid</button>
                        </form>
                      ) : null}
                      {row.status === "failed" ? (
                        <form action={retryPayoutAction}>
                          <input type="hidden" name="payout_id" value={row.id} />
                          <button className="button secondary" type="submit">Retry now</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="empty">No payouts in this state.</p> : null}
        </div>
      </section>
    </>
  );
}
