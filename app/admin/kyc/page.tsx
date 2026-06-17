import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type KycRow = {
  id: string;
  merchant_id: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  business_data: Record<string, string>;
  merchants: { display_name: string } | null;
};

export default async function AdminKycQueuePage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = params.status ?? "submitted";

  const admin = createAdminClient();
  const { data } = await admin
    .from("kyc_submissions")
    .select(
      "id, merchant_id, status, submitted_at, created_at, business_data, merchants(display_name)"
    )
    .eq("status", status)
    .order("submitted_at", { ascending: false, nullsFirst: false });

  const rows = (data ?? []) as unknown as KycRow[];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Compliance</p>
          <h1>KYC queue</h1>
        </div>
        <div className="topbar-actions">
          <span className="status-pill">{rows.length} entries</span>
        </div>
      </header>

      <section className="data-card">
        <form className="filter-row" method="get">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue={status}>
              <option value="submitted">submitted</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="draft">draft</option>
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
                <th>Merchant</th>
                <th>Status</th>
                <th>Legal name</th>
                <th>Business type</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.merchants?.display_name ?? row.merchant_id}</td>
                  <td>
                    <span className={`status-pill ${row.status}`}>{row.status}</span>
                  </td>
                  <td>{row.business_data?.legal_name ?? "—"}</td>
                  <td>{row.business_data?.business_type ?? "—"}</td>
                  <td>
                    {row.submitted_at
                      ? new Date(row.submitted_at).toLocaleString()
                      : new Date(row.created_at).toLocaleString()}
                  </td>
                  <td>
                    <Link className="mono" href={`/admin/kyc/${row.id}`}>
                      review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="empty">No submissions in this state.</p> : null}
        </div>
      </section>
    </>
  );
}
