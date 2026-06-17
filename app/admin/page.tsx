import Link from "next/link";
import {
  AlertTriangle,
  CircleDollarSign,
  ClipboardCheck,
  Percent,
  Store,
  Wallet
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

function formatHTG(value: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "HTG",
    maximumFractionDigits: 2
  }).format(value);
}

export default async function AdminOverviewPage() {
  const admin = createAdminClient();

  const [
    { count: merchantCount },
    { count: activeCount },
    { count: kycPendingCount },
    { count: failedDeliveries },
    { data: summaries },
    { data: recentMerchants }
  ] = await Promise.all([
    admin.from("merchants").select("id", { count: "exact", head: true }),
    admin.from("merchants").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("kyc_submissions").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    admin
      .from("webhook_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    admin.from("merchant_balance_summary").select("*"),
    admin
      .from("merchants")
      .select("id, display_name, status, live_enabled, created_at")
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  const totals = (summaries ?? []).reduce(
    (acc, row) => ({
      gross: acc.gross + Number(row.gross_volume ?? 0),
      gatewayFees: acc.gatewayFees + Number(row.gateway_fees ?? 0),
      net: acc.net + Number(row.merchant_net_balance ?? 0),
      count: acc.count + Number(row.successful_payment_count ?? 0)
    }),
    { gross: 0, gatewayFees: 0, net: 0, count: 0 }
  );

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Platform overview</p>
          <h1>Admin</h1>
          <p>Cross-merchant view of the gateway.</p>
        </div>
      </header>

      <section className="metrics-grid" aria-label="Platform metrics">
        <article className="metric-card">
          <span>
            <span className="metric-icon"><Store size={15} aria-hidden="true" /></span>
            Merchants
          </span>
          <strong>{merchantCount ?? 0}</strong>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
            {activeCount ?? 0} active
          </p>
        </article>
        <article className="metric-card">
          <span>
            <span className="metric-icon"><CircleDollarSign size={15} aria-hidden="true" /></span>
            Gross volume
          </span>
          <strong>{formatHTG(totals.gross)}</strong>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
            {totals.count} paid
          </p>
        </article>
        <article className="metric-card">
          <span>
            <span className="metric-icon"><Percent size={15} aria-hidden="true" /></span>
            Gateway fees collected
          </span>
          <strong>{formatHTG(totals.gatewayFees)}</strong>
        </article>
        <article className="metric-card">
          <span>
            <span className="metric-icon"><Wallet size={15} aria-hidden="true" /></span>
            Merchant net owed
          </span>
          <strong>{formatHTG(totals.net)}</strong>
        </article>
      </section>

      <section className="metrics-grid" aria-label="Action items">
        <article className="metric-card" style={{ borderColor: "var(--warn)" }}>
          <span>
            <span className="metric-icon"><ClipboardCheck size={15} aria-hidden="true" /></span>
            KYC awaiting review
          </span>
          <strong>{kycPendingCount ?? 0}</strong>
          <Link href="/admin/kyc" style={{ color: "var(--accent-dark)", fontWeight: 600 }}>
            Review queue →
          </Link>
        </article>
        <article className="metric-card" style={{ borderColor: "var(--danger)" }}>
          <span>
            <span className="metric-icon"><AlertTriangle size={15} aria-hidden="true" /></span>
            Failed webhook deliveries
          </span>
          <strong>{failedDeliveries ?? 0}</strong>
          <Link href="/admin/webhooks" style={{ color: "var(--accent-dark)", fontWeight: 600 }}>
            Investigate →
          </Link>
        </article>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Newest merchants</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Live</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(recentMerchants ?? []).map((merchant) => (
                <tr key={merchant.id}>
                  <td>{merchant.display_name}</td>
                  <td>
                    <span className={`status-pill ${merchant.status}`}>{merchant.status}</span>
                  </td>
                  <td>{merchant.live_enabled ? "yes" : "no"}</td>
                  <td>{new Date(merchant.created_at).toLocaleString()}</td>
                  <td>
                    <Link href={`/admin/merchants/${merchant.id}`} className="mono">
                      details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recentMerchants?.length ? (
            <p className="empty">No merchants yet.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}
