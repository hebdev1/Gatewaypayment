import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { retryDeliveryAction } from "./actions";

type Row = {
  id: string;
  merchant_id: string;
  endpoint_id: string;
  payment_id: string | null;
  event_type: string;
  status: string;
  attempts: number;
  response_status: number | null;
  last_error: string | null;
  next_attempt_at: string;
  created_at: string;
  merchants: { display_name: string } | null;
  webhook_endpoints: { url: string } | null;
};

export default async function AdminWebhooksPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = params.status ?? "failed";

  const admin = createAdminClient();
  const { data } = await admin
    .from("webhook_deliveries")
    .select(
      "id, merchant_id, endpoint_id, payment_id, event_type, status, attempts, response_status, last_error, next_attempt_at, created_at, merchants(display_name), webhook_endpoints(url)"
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1>Webhook deliveries</h1>
        </div>
      </header>

      <section className="data-card">
        <form className="filter-row" method="get">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue={status}>
              <option value="failed">failed</option>
              <option value="pending">pending</option>
              <option value="sending">sending</option>
              <option value="succeeded">succeeded</option>
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
                <th>Event</th>
                <th>Endpoint</th>
                <th>Attempts</th>
                <th>Last HTTP</th>
                <th>Next try</th>
                <th>Error</th>
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
                  <td>
                    <span className="mode-pill">{row.event_type}</span>
                  </td>
                  <td className="mono small">{row.webhook_endpoints?.url ?? "—"}</td>
                  <td>{row.attempts}</td>
                  <td>{row.response_status ?? "—"}</td>
                  <td>{new Date(row.next_attempt_at).toLocaleString()}</td>
                  <td className="mono small">
                    {row.last_error ? (
                      <details>
                        <summary>view</summary>
                        <pre>{row.last_error}</pre>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {row.status === "failed" ? (
                      <form action={retryDeliveryAction}>
                        <input type="hidden" name="delivery_id" value={row.id} />
                        <button className="button secondary" type="submit">
                          Retry now
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="empty">No deliveries in this state.</p> : null}
        </div>
      </section>
    </>
  );
}
