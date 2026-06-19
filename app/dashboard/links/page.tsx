import Link from "next/link";
import { Banknote, Link as LinkIcon } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { formatMoney } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";
import { publicSiteUrl } from "@/lib/env";

type PaymentLinkRow = {
  id: string;
  slug: string;
  name: string;
  mode: "sandbox" | "live";
  amount: string | null;
  currency: string;
  allow_custom_amount: boolean;
  use_count: number;
  max_uses: number | null;
  status: "active" | "archived";
  expires_at: string | null;
  created_at: string;
};

export default async function PaymentLinksPage() {
  const { merchant } = await requireMerchant();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_links")
    .select(
      "id, slug, name, mode, amount, currency, allow_custom_amount, use_count, max_uses, status, expires_at, created_at"
    )
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  const links = (data ?? []) as PaymentLinkRow[];
  const siteBase = publicSiteUrl().replace(/\/$/, "");

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Self-service</p>
          <h1>Payment links</h1>
          <p>Shareable links that anyone can pay without an integration.</p>
        </div>
        <div className="topbar-actions">
          <Link className="button" href="/dashboard/links/new">
            New payment link
          </Link>
        </div>
      </header>

      <section className="data-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mode</th>
                <th>Amount</th>
                <th>Uses</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>
                    <Link href={`/dashboard/links/${link.id}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                      <LinkIcon size={13} aria-hidden="true" style={{ marginRight: 6, verticalAlign: -2 }} />
                      {link.name}
                    </Link>
                    <div style={{ color: "var(--text-tertiary)", fontSize: 12, marginTop: 2 }}>
                      {siteBase}/pay/{link.slug}
                    </div>
                  </td>
                  <td>
                    <span className="mode-pill">{link.mode}</span>
                  </td>
                  <td>
                    {link.allow_custom_amount
                      ? "Custom"
                      : link.amount
                      ? formatMoney(link.amount, link.currency)
                      : "—"}
                  </td>
                  <td>
                    {link.use_count}
                    {link.max_uses ? ` / ${link.max_uses}` : ""}
                  </td>
                  <td>
                    <span className={`status-pill ${link.status === "active" ? "succeeded" : ""}`}>
                      {link.status}
                    </span>
                  </td>
                  <td>{new Date(link.created_at).toLocaleString()}</td>
                  <td>
                    <Link href={`/dashboard/links/${link.id}`} className="mono" style={{ color: "var(--accent)" }}>
                      open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!links.length ? (
            <p className="empty">
              <Banknote size={16} aria-hidden="true" /> No payment links yet. Click "New payment link" to create your first.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
