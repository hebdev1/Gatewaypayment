import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { createInvoiceAction } from "../actions";

export default async function NewInvoicePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { merchant } = await requireMerchant();
  const params = await searchParams;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            <Link href="/dashboard/invoices" style={{ color: "var(--text-tertiary)" }}>
              <ChevronLeft size={12} aria-hidden="true" /> Invoices
            </Link>
          </p>
          <h1>New invoice</h1>
        </div>
      </header>

      <form action={createInvoiceAction} className="form-panel stack" style={{ maxWidth: 880 }}>
        {params.error ? <p className="error">{decodeURIComponent(params.error)}</p> : null}

        <div className="split-grid">
          <div className="field">
            <label htmlFor="customer_email">Customer email</label>
            <input
              className="input"
              id="customer_email"
              name="customer_email"
              type="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="customer_name">Customer name (optional)</label>
            <input className="input" id="customer_name" name="customer_name" />
          </div>
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="mode">Mode</label>
            <select className="input" id="mode" name="mode" defaultValue={merchant.live_enabled ? "live" : "sandbox"}>
              <option value="sandbox">sandbox</option>
              {merchant.live_enabled ? <option value="live">live</option> : null}
            </select>
          </div>
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <select className="input" id="currency" name="currency" defaultValue={merchant.default_currency}>
              <option value="HTG">HTG</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="DOP">DOP</option>
              <option value="CAD">CAD</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="description">Description (optional)</label>
          <input className="input" id="description" name="description" />
        </div>

        <fieldset
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: 14
          }}
        >
          <legend style={{ padding: "0 8px", fontSize: 13, fontWeight: 600 }}>Line items</legend>
          {[0, 1, 2].map((i) => (
            <div className="split-grid" key={i} style={{ gridTemplateColumns: "2fr 1fr 1fr", marginBottom: 8 }}>
              <input
                className="input"
                name={`item_desc_${i}`}
                placeholder={i === 0 ? "Description (required for first row)" : "Description"}
                required={i === 0}
              />
              <input
                className="input"
                name={`item_qty_${i}`}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Qty"
                defaultValue={i === 0 ? "1" : ""}
              />
              <input
                className="input"
                name={`item_price_${i}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="Unit price"
                required={i === 0}
              />
            </div>
          ))}
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>
            Leave a row blank to skip it. Use the API for more than 3 line items.
          </p>
        </fieldset>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="tax_amount">Tax / fees (optional)</label>
            <input
              className="input"
              id="tax_amount"
              name="tax_amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
            />
          </div>
          <div className="field">
            <label htmlFor="due_at">Due date (optional)</label>
            <input className="input" id="due_at" name="due_at" type="datetime-local" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="notes">Notes for customer</label>
          <textarea className="input textarea" id="notes" name="notes" rows={3} />
        </div>

        <div className="row-actions">
          <Link className="button secondary" href="/dashboard/invoices">
            Cancel
          </Link>
          <button className="button secondary" type="submit" name="action" value="save_draft">
            Save as draft
          </button>
          <button className="button" type="submit" name="action" value="send">
            Save and email
          </button>
        </div>
      </form>
    </>
  );
}
