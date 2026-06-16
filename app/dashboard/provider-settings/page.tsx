import { Save } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveMoncashCredentialsAction } from "./actions";

type ProviderAccount = {
  id: string;
  mode: "sandbox" | "live";
  enabled: boolean;
  provider_fee_bps: number;
  provider_fee_fixed: string;
  metadata: {
    api_base_url?: string;
    gateway_base_url?: string;
  } | null;
};

function ProviderForm({
  mode,
  account,
  liveEnabled
}: {
  mode: "sandbox" | "live";
  account?: ProviderAccount;
  liveEnabled: boolean;
}) {
  const disabled = mode === "live" && !liveEnabled;
  const apiBasePlaceholder =
    mode === "live"
      ? "https://moncashbutton.digicelgroup.com/Api"
      : "https://sandbox.moncashbutton.digicelgroup.com/Api";
  const gatewayBasePlaceholder =
    mode === "live"
      ? "https://moncashbutton.digicelgroup.com/Moncash-middleware"
      : "https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware";

  return (
    <form action={saveMoncashCredentialsAction} className="form-panel stack">
      <input name="mode" type="hidden" value={mode} />
      <h2>{mode === "live" ? "Live MonCash" : "Sandbox MonCash"}</h2>
      <div className="field">
        <label htmlFor={`${mode}-client-id`}>Client ID</label>
        <input className="input" id={`${mode}-client-id`} name="client_id" disabled={disabled} />
      </div>
      <div className="field">
        <label htmlFor={`${mode}-client-secret`}>Client secret</label>
        <input
          className="input"
          id={`${mode}-client-secret`}
          name="client_secret"
          type="password"
          disabled={disabled}
        />
      </div>
      <div className="field">
        <label htmlFor={`${mode}-api-base`}>API base URL</label>
        <input
          className="input"
          id={`${mode}-api-base`}
          name="api_base_url"
          defaultValue={account?.metadata?.api_base_url ?? ""}
          placeholder={apiBasePlaceholder}
          disabled={disabled}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${mode}-gateway-base`}>Gateway base URL</label>
        <input
          className="input"
          id={`${mode}-gateway-base`}
          name="gateway_base_url"
          defaultValue={account?.metadata?.gateway_base_url ?? ""}
          placeholder={gatewayBasePlaceholder}
          disabled={disabled}
          required
        />
      </div>
      <div className="split-grid">
        <div className="field">
          <label htmlFor={`${mode}-provider-fee-bps`}>Provider fee bps</label>
          <input
            className="input"
            id={`${mode}-provider-fee-bps`}
            name="provider_fee_bps"
            type="number"
            min="0"
            max="10000"
            defaultValue={account?.provider_fee_bps ?? 0}
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label htmlFor={`${mode}-provider-fee-fixed`}>Provider fee fixed</label>
          <input
            className="input"
            id={`${mode}-provider-fee-fixed`}
            name="provider_fee_fixed"
            type="number"
            min="0"
            step="0.01"
            defaultValue={account?.provider_fee_fixed ?? "0"}
            disabled={disabled}
          />
        </div>
      </div>
      <label className="field" htmlFor={`${mode}-enabled`}>
        <span>Enabled</span>
        <input
          id={`${mode}-enabled`}
          name="enabled"
          type="checkbox"
          defaultChecked={account?.enabled ?? false}
          disabled={disabled}
        />
      </label>
      <button className="button" type="submit" disabled={disabled}>
        <Save size={16} aria-hidden="true" />
        Save
      </button>
      {disabled ? <p className="error">Live mode is locked for this merchant.</p> : null}
    </form>
  );
}

export default async function ProviderSettingsPage() {
  const { merchant } = await requireMerchant();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_provider_accounts")
    .select("id, mode, enabled, provider_fee_bps, provider_fee_fixed, metadata")
    .eq("merchant_id", merchant.id)
    .eq("provider", "moncash");

  const accounts = (data ?? []) as ProviderAccount[];
  const sandbox = accounts.find((account) => account.mode === "sandbox");
  const live = accounts.find((account) => account.mode === "live");

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Provider adapter</p>
          <h1>MonCash settings</h1>
        </div>
      </header>

      <div className="split-grid">
        <ProviderForm mode="sandbox" account={sandbox} liveEnabled={merchant.live_enabled} />
        <ProviderForm mode="live" account={live} liveEnabled={merchant.live_enabled} />
      </div>
    </>
  );
}
