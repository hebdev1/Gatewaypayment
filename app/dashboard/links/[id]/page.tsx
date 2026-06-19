import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Copy } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { formatMoney } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";
import { publicSiteUrl } from "@/lib/env";
import { renderQrSvg } from "@/lib/qrcode-server";
import { archivePaymentLinkAction, reactivatePaymentLinkAction } from "../actions";

type LinkRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  mode: "sandbox" | "live";
  amount: string | null;
  currency: string;
  allow_custom_amount: boolean;
  min_amount: string | null;
  max_amount: string | null;
  collect_customer_email: boolean;
  collect_customer_phone: boolean;
  collect_customer_name: boolean;
  max_uses: number | null;
  use_count: number;
  success_url: string | null;
  expires_at: string | null;
  status: "active" | "archived";
  created_at: string;
};

export default async function PaymentLinkDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { merchant } = await requireMerchant();
  const supabase = await createClient();

  const [{ data: linkRow }, { data: payments }] = await Promise.all([
    supabase
      .from("payment_links")
      .select("*")
      .eq("id", id)
      .eq("merchant_id", merchant.id)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("id, merchant_order_id, status, amount_gross, currency, created_at")
      .eq("payment_link_id", id)
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (!linkRow) notFound();

  const link = linkRow as LinkRow;
  const publicUrl = `${publicSiteUrl().replace(/\/$/, "")}/pay/${link.slug}`;
  const qrSvg = await renderQrSvg(publicUrl, 260);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            <Link href="/dashboard/links" style={{ color: "var(--text-tertiary)" }}>
              <ChevronLeft size={12} aria-hidden="true" /> Payment links
            </Link>
          </p>
          <h1>{link.name}</h1>
          {link.description ? <p>{link.description}</p> : null}
        </div>
        <div className="topbar-actions">
          <span className="mode-pill">{link.mode}</span>
          <span className={`status-pill ${link.status === "active" ? "succeeded" : ""}`}>
            {link.status}
          </span>
        </div>
      </header>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Share</h2>
        </div>
        <div
          style={{
            padding: 20,
            display: "grid",
            gridTemplateColumns: "260px 1fr",
            gap: 20,
            alignItems: "start"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 12,
              display: "grid",
              placeItems: "center"
            }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="stack" style={{ minWidth: 0 }}>
            <div className="field">
              <label>Public URL</label>
              <input className="input mono" readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} />
            </div>
            <div className="row-actions">
              <a className="button secondary" href={publicUrl} target="_blank" rel="noreferrer">
                Open
              </a>
              <a className="button secondary" href={`/api/qr?text=${encodeURIComponent(publicUrl)}&download=qr-${link.slug}.png`}>
                Download QR PNG
              </a>
            </div>
            <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              <Copy size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Click the URL to select it,
              then copy with Ctrl/Cmd+C.
            </p>
          </div>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Configuration</h2>
        </div>
        <dl className="kv-grid">
          <div>
            <dt>Amount</dt>
            <dd>
              {link.allow_custom_amount
                ? `Custom (${link.min_amount ?? "no min"} – ${link.max_amount ?? "no max"} ${link.currency})`
                : link.amount
                ? formatMoney(link.amount, link.currency)
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Uses</dt>
            <dd>
              {link.use_count}
              {link.max_uses ? ` / ${link.max_uses}` : ""}
            </dd>
          </div>
          <div>
            <dt>Collect</dt>
            <dd>
              {[
                link.collect_customer_email && "email",
                link.collect_customer_phone && "phone",
                link.collect_customer_name && "name"
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </dd>
          </div>
          <div>
            <dt>Success URL</dt>
            <dd>{link.success_url ?? "—"}</dd>
          </div>
          <div>
            <dt>Expires</dt>
            <dd>{link.expires_at ? new Date(link.expires_at).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{new Date(link.created_at).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Recent payments via this link</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Order</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td className="mono">
                    <Link href={`/dashboard/payments/${p.id}`}>{p.merchant_order_id}</Link>
                  </td>
                  <td>{formatMoney(p.amount_gross, p.currency)}</td>
                  <td>
                    <span className={`status-pill ${p.status}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!payments?.length ? <p className="empty">No payments yet.</p> : null}
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Actions</h2>
        </div>
        <div style={{ padding: 16 }}>
          {link.status === "active" ? (
            <form action={archivePaymentLinkAction}>
              <input type="hidden" name="link_id" value={link.id} />
              <button className="button secondary" type="submit">
                Archive link
              </button>
              <p className="muted" style={{ marginTop: 8 }}>
                Archived links can no longer be paid.
              </p>
            </form>
          ) : (
            <form action={reactivatePaymentLinkAction}>
              <input type="hidden" name="link_id" value={link.id} />
              <button className="button" type="submit">
                Reactivate link
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
