import { Ban } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApiKeyForm } from "./api-key-form";
import { revokeApiKeyAction } from "./actions";

type ApiKeyRow = {
  id: string;
  name: string;
  mode: string;
  prefix: string;
  last_four: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export default async function ApiKeysPage() {
  const { merchant } = await requireMerchant();
  const supabase = await createClient();
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, name, mode, prefix, last_four, created_at, last_used_at, revoked_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Developer access</p>
          <h1>API keys</h1>
        </div>
      </header>

      <div className="two-one-grid">
        <ApiKeyForm />

        <section className="data-card">
          <div className="data-card-header">
            <h2>Keys</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mode</th>
                  <th>Key</th>
                  <th>Last used</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(apiKeys as ApiKeyRow[] | null)?.map((key) => (
                  <tr key={key.id}>
                    <td>{key.name}</td>
                    <td><span className="mode-pill">{key.mode}</span></td>
                    <td className="mono">
                      {key.prefix}...{key.last_four}
                    </td>
                    <td>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "Never"}</td>
                    <td>
                      <span className={`status-pill ${key.revoked_at ? "failed" : ""}`}>
                        {key.revoked_at ? "revoked" : "active"}
                      </span>
                    </td>
                    <td>
                      {!key.revoked_at ? (
                        <form action={revokeApiKeyAction}>
                          <input name="key_id" type="hidden" value={key.id} />
                          <button className="icon-button secondary" title="Revoke key" type="submit">
                            <Ban size={16} aria-hidden="true" />
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!apiKeys?.length ? <p className="empty">No API keys yet.</p> : null}
          </div>
        </section>
      </div>
    </>
  );
}
