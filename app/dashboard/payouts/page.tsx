import Link from "next/link";
import { Banknote, Wallet } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { formatMoney } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";
import { saveScheduleAction } from "./actions";

type PayoutRow = {
  id: string;
  mode: string;
  amount_gross: string;
  amount_net: string;
  currency: string;
  status: string;
  destination_snapshot: { type?: string; moncash_phone?: string; bank_name?: string; nickname?: string };
  scheduled_for: string;
  completed_at: string | null;
  created_at: string;
};

type Balance = { merchant_id: string; mode: string; currency: string; available_amount: string };

export default async function PayoutsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { merchant } = await requireMerchant();
  const supabase = await createClient();

  const [{ data: balances }, { data: payouts }, { data: destinations }, { data: settings }] =
    await Promise.all([
      supabase
        .from("merchant_available_balance")
        .select("*")
        .eq("merchant_id", merchant.id),
      supabase
        .from("payouts")
        .select("id, mode, amount_gross, amount_net, currency, status, destination_snapshot, scheduled_for, completed_at, created_at")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("payout_destinations")
        .select("id, type, moncash_phone, bank_name, bank_account_number, nickname, is_default")
        .eq("merchant_id", merchant.id)
        .is("archived_at", null),
      supabase
        .from("merchants")
        .select("payout_schedule, payout_day_of_week, payout_day_of_month, payout_min_amount, auto_payouts_enabled")
        .eq("id", merchant.id)
        .single()
    ]);

  const balancesByMode = (balances ?? []) as Balance[];
  const liveBalance = balancesByMode.find((b) => b.mode === "live");
  const sandboxBalance = balancesByMode.find((b) => b.mode === "sandbox");
  const rows = (payouts ?? []) as PayoutRow[];
  const dests = destinations ?? [];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Settlement</p>
          <h1>Payouts</h1>
          <p>HaitiPay sends your net balance to your MonCash or bank on a schedule.</p>
        </div>
        <div className="topbar-actions">
          <Link className="button secondary" href="/dashboard/payouts/destinations">
            Manage destinations
          </Link>
        </div>
      </header>

      {params.saved ? <p className="notice">Payout schedule saved.</p> : null}
      {params.error ? <p className="error">{decodeURIComponent(params.error)}</p> : null}

      <section className="metrics-grid" aria-label="Balances">
        <article className="metric-card">
          <div className="label-row">
            <span>Available (live)</span>
            <span className="metric-icon"><Wallet size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">
            {formatMoney(liveBalance?.available_amount ?? 0, liveBalance?.currency ?? merchant.default_currency)}
          </div>
          <p className="sub">Ready for next payout</p>
        </article>
        <article className="metric-card">
          <div className="label-row">
            <span>Available (sandbox)</span>
            <span className="metric-icon"><Wallet size={15} aria-hidden="true" /></span>
          </div>
          <div className="value">
            {formatMoney(sandboxBalance?.available_amount ?? 0, sandboxBalance?.currency ?? merchant.default_currency)}
          </div>
          <p className="sub">Test mode — never paid out</p>
        </article>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Payout schedule</h2>
        </div>
        <form action={saveScheduleAction} className="stack" style={{ padding: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              name="auto_payouts_enabled"
              defaultChecked={settings?.auto_payouts_enabled ?? false}
            />
            Enable automatic payouts
          </label>
          <p className="muted" style={{ marginTop: -8 }}>
            When enabled, HaitiPay automatically sends your available balance to your default
            destination on the schedule below. Disable to require manual admin trigger.
          </p>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="payout_schedule">Schedule</label>
              <select className="input" id="payout_schedule" name="payout_schedule" defaultValue={settings?.payout_schedule ?? "weekly"}>
                <option value="manual_only">Manual only</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="payout_min_amount">Minimum amount (HTG)</label>
              <input
                className="input"
                id="payout_min_amount"
                name="payout_min_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings?.payout_min_amount ?? "500"}
              />
            </div>
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="payout_day_of_week">Day of week (if weekly)</label>
              <select className="input" id="payout_day_of_week" name="payout_day_of_week" defaultValue={String(settings?.payout_day_of_week ?? 2)}>
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="payout_day_of_month">Day of month (if monthly, 1–28)</label>
              <input
                className="input"
                id="payout_day_of_month"
                name="payout_day_of_month"
                type="number"
                min="1"
                max="28"
                defaultValue={settings?.payout_day_of_month ?? 1}
              />
            </div>
          </div>

          <div className="row-actions">
            <button className="button" type="submit">Save schedule</button>
          </div>

          {dests.length === 0 ? (
            <p className="notice" style={{ marginTop: 8 }}>
              No payout destination configured yet. <Link href="/dashboard/payouts/destinations">Add one →</Link>
            </p>
          ) : null}
        </form>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Payout history</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Mode</th>
                <th>Destination</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Status</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td><span className="mode-pill">{p.mode}</span></td>
                  <td className="mono small">
                    {p.destination_snapshot?.type === "moncash"
                      ? `MonCash ${p.destination_snapshot.moncash_phone}`
                      : p.destination_snapshot?.bank_name
                      ? `Bank ${p.destination_snapshot.bank_name}`
                      : p.destination_snapshot?.type ?? "—"}
                  </td>
                  <td>{formatMoney(p.amount_gross, p.currency)}</td>
                  <td>{formatMoney(p.amount_net, p.currency)}</td>
                  <td><span className={`status-pill ${p.status}`}>{p.status}</span></td>
                  <td>{p.completed_at ? new Date(p.completed_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="empty">
              <Banknote size={16} aria-hidden="true" /> No payouts yet.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
