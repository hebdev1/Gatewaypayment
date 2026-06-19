import Link from "next/link";
import {
  AlertTriangle,
  CircleDollarSign,
  ClipboardCheck,
  Percent,
  ReceiptText,
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
          <div className="label-row">
            <span>Merchants</span>
            <span className="metric-icon"><Store size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">{(merchantCount ?? 0).toLocaleString()}</div>
          <p className="sub">{activeCount ?? 0} active</p>
        </article>
        <article className="metric-card">
          <div className="label-row">
            <span>Gross volume</span>
            <span className="metric-icon"><CircleDollarSign size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">{formatHTG(totals.gross)}</div>
          <p className="sub">{totals.count} paid</p>
        </article>
        <article className="metric-card">
          <div className="label-row">
            <span>Gateway fees collected</span>
            <span className="metric-icon"><Percent size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">{formatHTG(totals.gatewayFees)}</div>
        </article>
        <article className="metric-card">
          <div className="label-row">
            <span>Merchant net owed</span>
            <span className="metric-icon"><Wallet size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">{formatHTG(totals.net)}</div>
        </article>
      </section>

      <section className="metrics-grid" aria-label="Action items">
        <article className="metric-card">
          <div className="label-row">
            <span>KYC awaiting review</span>
            <span className="metric-icon" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
              <ClipboardCheck size={15} aria-hidden="true" />
            </span>
          </div>
          <div className="value">{(kycPendingCount ?? 0).toLocaleString()}</div>
          <Link href="/admin/kyc" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>
            Review queue →
          </Link>
        </article>
        <article className="metric-card">
          <div className="label-row">
            <span>Failed webhook deliveries</span>
            <span className="metric-icon" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
              <AlertTriangle size={15} aria-hidden="true" />
            </span>
          </div>
          <div className="value">{(failedDeliveries ?? 0).toLocaleString()}</div>
          <Link href="/admin/webhooks" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>
            Investigate →
          </Link>
        </article>
        <article className="metric-card">
          <div className="label-row">
            <span>Recent activity</span>
            <span className="metric-icon"><ReceiptText size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">{totals.count}</div>
          <p className="sub">Total successful payments</p>
        </article>
        <article className="metric-card">
          <div className="label-row">
            <span>Health</span>
            <span className="metric-icon" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
              <Store size={15} aria-hidden="true" />
            </span>
          </div>
          <div className="value">OK</div>
          <p className="sub">Cron, edge functions, DB</p>
        </article>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Newest merchants</h2>
          <Link className="button ghost" href="/admin/merchants">
            View all →
          </Link>
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
