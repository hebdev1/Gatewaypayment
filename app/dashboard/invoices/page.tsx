import Link from "next/link";
import { FileText } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { formatMoney } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";

type InvoiceRow = {
  id: string;
  number: string;
  mode: string;
  customer_email: string;
  customer_name: string | null;
  total_amount: string;
  currency: string;
  status: string;
  due_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export default async function InvoicesPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const { merchant } = await requireMerchant();
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select(
      "id, number, mode, customer_email, customer_name, total_amount, currency, status, due_at, sent_at, paid_at, created_at"
    )
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data } = await query;
  const invoices = (data ?? []) as InvoiceRow[];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Billing</p>
          <h1>Invoices</h1>
          <p>Send payable invoices to your customers.</p>
        </div>
        <div className="topbar-actions">
          <Link className="button" href="/dashboard/invoices/new">
            New invoice
          </Link>
        </div>
      </header>

      <section className="data-card">
        <form className="filter-row" method="get">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue={params.status ?? ""}>
              <option value="">All</option>
              <option value="draft">draft</option>
              <option value="open">open</option>
              <option value="paid">paid</option>
              <option value="void">void</option>
              <option value="uncollectible">uncollectible</option>
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
                <th>Number</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Due</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="mono">
                    <Link href={`/dashboard/invoices/${invoice.id}`} style={{ color: "var(--accent)" }}>
                      {invoice.number}
                    </Link>
                  </td>
                  <td>
                    {invoice.customer_name ? `${invoice.customer_name} · ` : ""}
                    {invoice.customer_email}
                  </td>
                  <td>{formatMoney(invoice.total_amount, invoice.currency)}</td>
                  <td>
                    <span className={`status-pill ${invoice.status === "paid" ? "succeeded" : invoice.status}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td>{invoice.due_at ? new Date(invoice.due_at).toLocaleString() : "—"}</td>
                  <td>{new Date(invoice.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!invoices.length ? (
            <p className="empty">
              <FileText size={16} aria-hidden="true" /> No invoices yet.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
