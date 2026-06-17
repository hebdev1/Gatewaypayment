import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  setMerchantStatusAction,
  toggleLiveModeAction
} from "./actions";

export default async function AdminMerchantDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = createAdminClient();

  const [
    { data: merchant },
    { data: keys },
    { data: providerAccounts },
    { data: webhookEndpoints },
    { data: kycHistory },
    { data: summaries },
    { data: members }
  ] = await Promise.all([
    admin
      .from("merchants")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("api_keys")
      .select("id, name, mode, prefix, last_four, created_at, last_used_at, revoked_at")
      .eq("merchant_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("payment_provider_accounts")
      .select("provider, mode, enabled, inbound_webhook_token_prefix")
      .eq("merchant_id", id),
    admin
      .from("webhook_endpoints")
      .select("id, mode, url, enabled, created_at")
      .eq("merchant_id", id),
    admin
      .from("kyc_submissions")
      .select("id, status, submitted_at, reviewed_at, notes")
      .eq("merchant_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("merchant_balance_summary")
      .select("*")
      .eq("merchant_id", id),
    admin
      .from("merchant_members")
      .select("user_id, role, created_at")
      .eq("merchant_id", id)
  ]);

  if (!merchant) {
    notFound();
  }

  const totalNet = (summaries ?? []).reduce(
    (acc, row) => acc + Number(row.merchant_net_balance ?? 0),
    0
  );

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            <Link href="/admin/merchants">
              <ChevronLeft size={14} aria-hidden="true" /> Merchants
            </Link>
          </p>
          <h1>{merchant.display_name}</h1>
          <p className="mono">{merchant.id}</p>
        </div>
        <div className="topbar-actions">
          <span className={`status-pill ${merchant.status}`}>{merchant.status}</span>
          <span className="mode-pill">{merchant.live_enabled ? "live + sandbox" : "sandbox"}</span>
        </div>
      </header>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Admin actions</h2>
        </div>
        <div style={{ padding: 16, display: "grid", gap: 14 }}>
          <form action={setMerchantStatusAction} className="row-actions">
            <input type="hidden" name="merchant_id" value={merchant.id} />
            <select className="input" name="status" defaultValue={merchant.status}>
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </select>
            <input
              className="input"
              name="notes"
              placeholder="Reason / notes (audit log)"
              style={{ minWidth: 240 }}
            />
            <button className="button" type="submit">
              Update status
            </button>
          </form>

          <form action={toggleLiveModeAction} className="row-actions">
            <input type="hidden" name="merchant_id" value={merchant.id} />
            <input type="hidden" name="enabled" value={merchant.live_enabled ? "false" : "true"} />
            <input
              className="input"
              name="notes"
              placeholder="Reason / notes (audit log)"
              style={{ minWidth: 240 }}
            />
            <button className="button secondary" type="submit">
              {merchant.live_enabled ? "Disable live mode" : "Enable live mode"}
            </button>
          </form>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Profile</h2>
        </div>
        <dl className="kv-grid">
          <div>
            <dt>Legal name</dt>
            <dd>{merchant.legal_name ?? "—"}</dd>
          </div>
          <div>
            <dt>Business email</dt>
            <dd>{merchant.email ?? "—"}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{merchant.phone ?? "—"}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{merchant.country_code}</dd>
          </div>
          <div>
            <dt>Default currency</dt>
            <dd>{merchant.default_currency}</dd>
          </div>
          <div>
            <dt>Merchant net owed (cumulative)</dt>
            <dd>{totalNet.toFixed(2)} {merchant.default_currency}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{new Date(merchant.created_at).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>API keys ({keys?.length ?? 0})</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mode</th>
                <th>Key</th>
                <th>Status</th>
                <th>Last used</th>
              </tr>
            </thead>
            <tbody>
              {(keys ?? []).map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>
                    <span className="mode-pill">{key.mode}</span>
                  </td>
                  <td className="mono">
                    {key.prefix}…{key.last_four}
                  </td>
                  <td>
                    <span className={`status-pill ${key.revoked_at ? "failed" : ""}`}>
                      {key.revoked_at ? "revoked" : "active"}
                    </span>
                  </td>
                  <td>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Provider accounts ({providerAccounts?.length ?? 0})</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Mode</th>
                <th>Enabled</th>
                <th>Inbound webhook token</th>
              </tr>
            </thead>
            <tbody>
              {(providerAccounts ?? []).map((acc, i) => (
                <tr key={i}>
                  <td>{acc.provider}</td>
                  <td>
                    <span className="mode-pill">{acc.mode}</span>
                  </td>
                  <td>{acc.enabled ? "yes" : "no"}</td>
                  <td className="mono">
                    {acc.inbound_webhook_token_prefix
                      ? `${acc.inbound_webhook_token_prefix}…`
                      : "none"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Webhook endpoints ({webhookEndpoints?.length ?? 0})</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Mode</th>
                <th>Enabled</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(webhookEndpoints ?? []).map((endpoint) => (
                <tr key={endpoint.id}>
                  <td className="mono">{endpoint.url}</td>
                  <td>
                    <span className="mode-pill">{endpoint.mode}</span>
                  </td>
                  <td>{endpoint.enabled ? "yes" : "no"}</td>
                  <td>{new Date(endpoint.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>KYC history</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Submitted</th>
                <th>Reviewed</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(kycHistory ?? []).map((kyc) => (
                <tr key={kyc.id}>
                  <td>
                    <span className={`status-pill ${kyc.status}`}>{kyc.status}</span>
                  </td>
                  <td>{kyc.submitted_at ? new Date(kyc.submitted_at).toLocaleString() : "—"}</td>
                  <td>{kyc.reviewed_at ? new Date(kyc.reviewed_at).toLocaleString() : "—"}</td>
                  <td>{kyc.notes ?? "—"}</td>
                  <td>
                    <Link className="mono" href={`/admin/kyc/${kyc.id}`}>
                      review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Team ({members?.length ?? 0})</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((member, i) => (
                <tr key={i}>
                  <td className="mono">{member.user_id}</td>
                  <td>{member.role}</td>
                  <td>{new Date(member.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
