import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { createPaymentLinkAction } from "../actions";

export default async function NewPaymentLinkPage({
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
            <Link href="/dashboard/links" style={{ color: "var(--text-tertiary)" }}>
              <ChevronLeft size={12} aria-hidden="true" /> Payment links
            </Link>
          </p>
          <h1>New payment link</h1>
        </div>
      </header>

      <form action={createPaymentLinkAction} className="form-panel stack" style={{ maxWidth: 720 }}>
        {params.error ? <p className="error">{decodeURIComponent(params.error)}</p> : null}

        <div className="field">
          <label htmlFor="name">Name (internal)</label>
          <input className="input" id="name" name="name" required placeholder="Friday class fee" />
        </div>

        <div className="field">
          <label htmlFor="description">Description (shown to payer)</label>
          <textarea className="input textarea" id="description" name="description" rows={2} />
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
              <option value="HTG">HTG · Haitian gourde</option>
              <option value="USD">USD · US dollar</option>
              <option value="EUR">EUR · Euro</option>
              <option value="DOP">DOP · Dominican peso</option>
              <option value="CAD">CAD · Canadian dollar</option>
            </select>
          </div>
        </div>

        <fieldset
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: 14
          }}
        >
          <legend style={{ padding: "0 8px", fontSize: 13, fontWeight: 600 }}>Amount</legend>
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 12 }}
          >
            <input type="checkbox" name="allow_custom_amount" value="on" id="custom_amount" />
            Let the payer choose the amount
          </label>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="amount">Fixed amount</label>
              <input
                className="input"
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="500.00"
              />
            </div>
            <div className="field">
              <label htmlFor="max_uses">Max uses (blank = unlimited)</label>
              <input
                className="input"
                id="max_uses"
                name="max_uses"
                type="number"
                min="1"
                placeholder="∞"
              />
            </div>
          </div>

          <div className="split-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor="min_amount">Min (if custom)</label>
              <input
                className="input"
                id="min_amount"
                name="min_amount"
                type="number"
                step="0.01"
                min="0.01"
              />
            </div>
            <div className="field">
              <label htmlFor="max_amount">Max (if custom)</label>
              <input
                className="input"
                id="max_amount"
                name="max_amount"
                type="number"
                step="0.01"
                min="0.01"
              />
            </div>
          </div>
        </fieldset>

        <fieldset
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: 14
          }}
        >
          <legend style={{ padding: "0 8px", fontSize: 13, fontWeight: 600 }}>Collect from payer</legend>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" name="collect_customer_email" value="on" defaultChecked />
            Email
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 6 }}>
            <input type="checkbox" name="collect_customer_phone" value="on" />
            Phone
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 6 }}>
            <input type="checkbox" name="collect_customer_name" value="on" />
            Name
          </label>
        </fieldset>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="success_url">Success redirect URL (optional)</label>
            <input
              className="input"
              id="success_url"
              name="success_url"
              type="url"
              placeholder="https://yourstore.com/thanks"
            />
          </div>
          <div className="field">
            <label htmlFor="expires_at">Expires at (optional)</label>
            <input className="input" id="expires_at" name="expires_at" type="datetime-local" />
          </div>
        </div>

        <div className="row-actions">
          <Link className="button secondary" href="/dashboard/links">
            Cancel
          </Link>
          <button className="button" type="submit">
            Create payment link
          </button>
        </div>
      </form>
    </>
  );
}
