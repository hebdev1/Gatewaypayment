import Link from "next/link";
import { ChevronLeft, Star, Trash2 } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addDestinationAction,
  archiveDestinationAction,
  setDefaultDestinationAction
} from "./actions";

type Destination = {
  id: string;
  mode: string;
  type: string;
  moncash_phone: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  nickname: string | null;
  is_default: boolean;
  verified_at: string | null;
  created_at: string;
};

export default async function DestinationsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const { merchant } = await requireMerchant();
  const supabase = await createClient();

  const { data } = await supabase
    .from("payout_destinations")
    .select("*")
    .eq("merchant_id", merchant.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const destinations = (data ?? []) as Destination[];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            <Link href="/dashboard/payouts" style={{ color: "var(--text-tertiary)" }}>
              <ChevronLeft size={12} aria-hidden="true" /> Payouts
            </Link>
          </p>
          <h1>Payout destinations</h1>
          <p>Where you want HaitiPay to send your money.</p>
        </div>
      </header>

      {params.error ? <p className="error">{decodeURIComponent(params.error)}</p> : null}
      {params.saved ? <p className="notice">Destination saved.</p> : null}

      <section className="data-card">
        <div className="data-card-header">
          <h2>Your destinations ({destinations.length})</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Default</th>
                <th>Mode</th>
                <th>Type</th>
                <th>Details</th>
                <th>Nickname</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {destinations.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.is_default ? (
                      <span className="status-pill succeeded">
                        <Star size={11} aria-hidden="true" /> Default
                      </span>
                    ) : (
                      <form action={setDefaultDestinationAction}>
                        <input type="hidden" name="destination_id" value={d.id} />
                        <button className="button secondary" type="submit">
                          Make default
                        </button>
                      </form>
                    )}
                  </td>
                  <td><span className="mode-pill">{d.mode}</span></td>
                  <td>{d.type}</td>
                  <td className="mono small">
                    {d.type === "moncash" && d.moncash_phone}
                    {d.type === "bank_account" && `${d.bank_name} — ${d.bank_account_number}`}
                    {d.type === "cash_pickup" && "Cash pickup at HaitiPay office"}
                  </td>
                  <td>{d.nickname ?? "—"}</td>
                  <td>{new Date(d.created_at).toLocaleString()}</td>
                  <td>
                    {!d.is_default ? (
                      <form action={archiveDestinationAction}>
                        <input type="hidden" name="destination_id" value={d.id} />
                        <button className="button secondary" type="submit" title="Archive">
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!destinations.length ? <p className="empty">No destination yet.</p> : null}
        </div>
      </section>

      <section className="form-panel" style={{ marginTop: 18 }}>
        <h2>Add a destination</h2>
        <form action={addDestinationAction} className="stack">
          <div className="split-grid">
            <div className="field">
              <label htmlFor="mode">Mode</label>
              <select className="input" id="mode" name="mode" defaultValue={merchant.live_enabled ? "live" : "sandbox"}>
                <option value="sandbox">sandbox</option>
                {merchant.live_enabled ? <option value="live">live</option> : null}
              </select>
            </div>
            <div className="field">
              <label htmlFor="type">Type</label>
              <select className="input" id="type" name="type" defaultValue="moncash">
                <option value="moncash">MonCash wallet</option>
                <option value="bank_account">Bank account</option>
                <option value="cash_pickup">Cash pickup at HaitiPay office</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="moncash_phone">MonCash phone (11 digits, e.g. 50922334455)</label>
            <input
              className="input mono"
              id="moncash_phone"
              name="moncash_phone"
              inputMode="numeric"
              pattern="[0-9]{8,15}"
              placeholder="50922334455"
            />
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="bank_name">Bank name</label>
              <input className="input" id="bank_name" name="bank_name" placeholder="Sogebank" />
            </div>
            <div className="field">
              <label htmlFor="bank_account_holder">Account holder</label>
              <input className="input" id="bank_account_holder" name="bank_account_holder" />
            </div>
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="bank_account_number">Account number</label>
              <input className="input mono" id="bank_account_number" name="bank_account_number" />
            </div>
            <div className="field">
              <label htmlFor="bank_swift">SWIFT / BIC (optional)</label>
              <input className="input mono" id="bank_swift" name="bank_swift" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="nickname">Nickname (optional)</label>
            <input className="input" id="nickname" name="nickname" placeholder="My MonCash wallet" />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" name="is_default" defaultChecked />
            Set as default destination for this mode
          </label>

          <div className="row-actions">
            <button className="button" type="submit">Add destination</button>
          </div>
        </form>
      </section>
    </>
  );
}
