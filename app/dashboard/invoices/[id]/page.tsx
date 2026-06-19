import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { formatMoney } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";
import { publicSiteUrl } from "@/lib/env";
import { sendInvoiceAction, voidInvoiceAction } from "../actions";

type Invoice = {
  id: string;
  number: string;
  slug: string;
  mode: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  description: string | null;
  notes: string | null;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  currency: string;
  status: string;
  due_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  payment_link_id: string | null;
  created_at: string;
};

type Item = {
  id: string;
  position: number;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
};

export default async function InvoiceDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { merchant } = await requireMerchant();
  const supabase = await createClient();

  const [{ data: invoiceRow }, { data: items }, { data: payments }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("merchant_id", merchant.id)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("payments")
      .select("id, merchant_order_id, status, amount_gross, currency, created_at")
      .eq("invoice_id", id)
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
  ]);

  if (!invoiceRow) notFound();
  const invoice = invoiceRow as unknown as Invoice;
  const publicUrl = `${publicSiteUrl().replace(/\/$/, "")}/i/${invoice.slug}`;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            <Link href="/dashboard/invoices" style={{ color: "var(--text-tertiary)" }}>
              <ChevronLeft size={12} aria-hidden="true" /> Invoices
            </Link>
          </p>
          <h1>{invoice.number}</h1>
          <p>To: {invoice.customer_name ? `${invoice.customer_name} · ` : ""}{invoice.customer_email}</p>
        </div>
        <div className="topbar-actions">
          <span className="mode-pill">{invoice.mode}</span>
          <span className={`status-pill ${invoice.status === "paid" ? "succeeded" : invoice.status}`}>
            {invoice.status}
          </span>
        </div>
      </header>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Public URL</h2>
        </div>
        <div style={{ padding: 16 }}>
          <input className="input mono" readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} />
          <div className="row-actions" style={{ marginTop: 10 }}>
            <a className="button secondary" href={publicUrl} target="_blank" rel="noreferrer">
              Open
            </a>
            {invoice.status === "draft" || invoice.status === "open" ? (
              <form action={sendInvoiceAction}>
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <button className="button" type="submit">
                  <Mail size={14} aria-hidden="true" /> Send (or resend) by email
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Line items</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {((items ?? []) as Item[]).map((it) => (
                <tr key={it.id}>
                  <td>{it.description}</td>
                  <td>{it.quantity}</td>
                  <td>{formatMoney(it.unit_price, invoice.currency)}</td>
                  <td>{formatMoney(it.amount, invoice.currency)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ textAlign: "right", fontWeight: 600 }}>
                  Subtotal
                </td>
                <td>{formatMoney(invoice.subtotal_amount, invoice.currency)}</td>
              </tr>
              {Number(invoice.tax_amount) > 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: 600 }}>
                    Tax
                  </td>
                  <td>{formatMoney(invoice.tax_amount, invoice.currency)}</td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>
                  Total
                </td>
                <td>
                  <strong>{formatMoney(invoice.total_amount, invoice.currency)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {payments?.length ? (
        <section className="data-card">
          <div className="data-card-header">
            <h2>Payments</h2>
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
                {payments.map((p) => (
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
          </div>
        </section>
      ) : null}

      {invoice.status !== "paid" && invoice.status !== "void" ? (
        <section className="data-card">
          <div className="data-card-header">
            <h2>Danger</h2>
          </div>
          <div style={{ padding: 16 }}>
            <form action={voidInvoiceAction}>
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <button className="button danger" type="submit">
                Void invoice
              </button>
              <p className="muted" style={{ marginTop: 8 }}>
                Void cancels the invoice. The public URL will show "Voided" and no
                payment will be accepted.
              </p>
            </form>
          </div>
        </section>
      ) : null}
    </>
  );
}
