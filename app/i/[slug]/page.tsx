import { CheckCircle2, CreditCard } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { payInvoiceAction } from "./actions";

type Invoice = {
  id: string;
  number: string;
  slug: string;
  merchant_id: string;
  mode: "sandbox" | "live";
  customer_email: string;
  customer_name: string | null;
  description: string | null;
  notes: string | null;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  currency: string;
  due_at: string | null;
  status: string;
  paid_at: string | null;
  merchants: { display_name: string } | { display_name: string }[] | null;
};

type Item = {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
};

function fmt(amount: string | number, currency: string) {
  return `${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function unavailable(message: string) {
  return (
    <main className="checkout-shell">
      <section className="checkout-panel">
        <h1>Invoice unavailable</h1>
        <p className="error">{message}</p>
      </section>
    </main>
  );
}

export default async function PublicInvoicePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const admin = createAdminClient();

  const { data: invoiceData } = await admin
    .from("invoices")
    .select("*, merchants(display_name)")
    .eq("slug", slug)
    .maybeSingle();

  if (!invoiceData) return unavailable("This invoice does not exist.");
  const invoice = invoiceData as unknown as Invoice;

  if (invoice.status === "void") return unavailable("This invoice has been voided.");
  if (invoice.status === "draft") return unavailable("This invoice is still a draft.");

  const { data: items } = await admin
    .from("invoice_items")
    .select("id, description, quantity, unit_price, amount")
    .eq("invoice_id", invoice.id)
    .order("position", { ascending: true });

  const merchantName = Array.isArray(invoice.merchants)
    ? invoice.merchants[0]?.display_name
    : invoice.merchants?.display_name;

  const paid = invoice.status === "paid";

  return (
    <main className="checkout-shell">
      <section className="checkout-panel" style={{ maxWidth: 620 }}>
        <div className="brand-row">
          <div>
            <p className="eyebrow">Invoice from {merchantName ?? "Merchant"}</p>
            <h1>{invoice.number}</h1>
            {invoice.description ? (
              <p style={{ color: "var(--text-secondary)" }}>{invoice.description}</p>
            ) : null}
          </div>
          <div className="brand-mark">
            {paid ? <CheckCircle2 size={18} aria-hidden="true" /> : <CreditCard size={18} aria-hidden="true" />}
          </div>
        </div>

        <div className="checkout-amount">
          <span>{paid ? "Paid" : "Amount due"}</span>
          <strong>{fmt(invoice.total_amount, invoice.currency)}</strong>
        </div>

        {invoice.due_at && !paid ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", marginBottom: 12 }}>
            Due {new Date(invoice.due_at).toLocaleDateString()}
          </p>
        ) : null}

        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {((items ?? []) as Item[]).map((it) => (
              <tr key={it.id}>
                <td>{it.description}</td>
                <td>{it.quantity}</td>
                <td>{fmt(it.amount, invoice.currency)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ textAlign: "right", fontWeight: 600 }}>
                Subtotal
              </td>
              <td>{fmt(invoice.subtotal_amount, invoice.currency)}</td>
            </tr>
            {Number(invoice.tax_amount) > 0 ? (
              <tr>
                <td colSpan={2} style={{ textAlign: "right", fontWeight: 600 }}>
                  Tax
                </td>
                <td>{fmt(invoice.tax_amount, invoice.currency)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={2} style={{ textAlign: "right", fontWeight: 700 }}>
                Total
              </td>
              <td>
                <strong>{fmt(invoice.total_amount, invoice.currency)}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        {invoice.notes ? (
          <p style={{ marginTop: 16, color: "var(--text-secondary)", fontSize: 13 }}>{invoice.notes}</p>
        ) : null}

        {!paid ? (
          <form action={payInvoiceAction} style={{ marginTop: 18 }}>
            <input type="hidden" name="slug" value={invoice.slug} />
            {search.error ? <p className="error">{decodeURIComponent(search.error)}</p> : null}
            <button className="button full" type="submit">
              Pay {fmt(invoice.total_amount, invoice.currency)}
            </button>
          </form>
        ) : (
          <p style={{ marginTop: 18, textAlign: "center", color: "var(--success)" }}>
            ✓ Paid {invoice.paid_at ? `on ${new Date(invoice.paid_at).toLocaleString()}` : ""}
          </p>
        )}
      </section>
    </main>
  );
}
