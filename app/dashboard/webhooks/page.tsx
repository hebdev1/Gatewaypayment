import { PowerOff } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { disableWebhookEndpointAction } from "./actions";
import { WebhookEndpointForm } from "./webhook-form";

type WebhookEndpoint = {
  id: string;
  mode: string;
  url: string;
  description: string | null;
  enabled: boolean;
  created_at: string;
};

type WebhookDelivery = {
  id: string;
  event_type: string;
  status: string;
  attempts: number;
  response_status: number | null;
  created_at: string;
};

export default async function WebhooksPage() {
  const { merchant } = await requireMerchant();
  const supabase = await createClient();
  const [{ data: endpoints }, { data: deliveries }] = await Promise.all([
    supabase
      .from("webhook_endpoints")
      .select("id, mode, url, description, enabled, created_at")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("webhook_deliveries")
      .select("id, event_type, status, attempts, response_status, created_at")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(8)
  ]);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Merchant notifications</p>
          <h1>Webhooks</h1>
        </div>
      </header>

      <div className="two-one-grid">
        <WebhookEndpointForm />

        <section className="data-card">
          <div className="data-card-header">
            <h2>Endpoints</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(endpoints as WebhookEndpoint[] | null)?.map((endpoint) => (
                  <tr key={endpoint.id}>
                    <td className="mono">{endpoint.url}</td>
                    <td><span className="mode-pill">{endpoint.mode}</span></td>
                    <td>
                      <span className={`status-pill ${endpoint.enabled ? "" : "failed"}`}>
                        {endpoint.enabled ? "enabled" : "disabled"}
                      </span>
                    </td>
                    <td>
                      {endpoint.enabled ? (
                        <form action={disableWebhookEndpointAction}>
                          <input name="endpoint_id" type="hidden" value={endpoint.id} />
                          <button className="icon-button secondary" title="Disable endpoint" type="submit">
                            <PowerOff size={16} aria-hidden="true" />
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!endpoints?.length ? <p className="empty">No webhook endpoints yet.</p> : null}
          </div>
        </section>
      </div>

      <section className="data-card" style={{ marginTop: 18 }}>
        <div className="data-card-header">
          <h2>Recent deliveries</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>HTTP</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(deliveries as WebhookDelivery[] | null)?.map((delivery) => (
                <tr key={delivery.id}>
                  <td>{delivery.event_type}</td>
                  <td>
                    <span className={`status-pill ${delivery.status}`}>{delivery.status}</span>
                  </td>
                  <td>{delivery.attempts}</td>
                  <td>{delivery.response_status ?? "-"}</td>
                  <td>{new Date(delivery.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!deliveries?.length ? <p className="empty">No webhook deliveries yet.</p> : null}
        </div>
      </section>
    </>
  );
}
