import { decryptJson } from "../crypto.ts";
import { getEnv } from "../env.ts";
import { MonCashAdapter, type MonCashCredentials } from "./moncash.ts";
import type { PaymentProviderAdapter, ProviderName } from "./types.ts";

/**
 * Resolve the MonCash adapter for Model A (Settlement).
 *
 * HaitiPay's own master MonCash credentials are configured via Edge Function
 * Secrets (env vars). The merchant's `payment_provider_accounts` row is no
 * longer used for credentials — it stays as a record of which merchants are
 * eligible for which providers + their fee structure.
 *
 * If HAITIPAY_MONCASH_CLIENT_ID is not set, we fall back to the legacy path
 * (decrypt per-merchant credentials from payment_provider_credentials). This
 * keeps existing sandbox setups working while the migration completes.
 */
export async function getProviderAdapter(
  supabase: any,
  merchantId: string,
  mode: "sandbox" | "live",
  provider: ProviderName
): Promise<{
  adapter: PaymentProviderAdapter;
  account: {
    id: string;
    provider_fee_bps: number;
    provider_fee_fixed: number;
  };
}> {
  const { data: account, error: accountError } = await supabase
    .from("payment_provider_accounts")
    .select("id, provider_fee_bps, provider_fee_fixed")
    .eq("merchant_id", merchantId)
    .eq("mode", mode)
    .eq("provider", provider)
    .eq("enabled", true)
    .maybeSingle();

  if (accountError || !account) {
    throw new Error(`No enabled ${provider} account is configured for ${mode} mode.`);
  }

  if (provider === "moncash") {
    return {
      adapter: await resolveMoncashAdapter(supabase, account.id, mode),
      account
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Build a MonCash adapter using HaitiPay master credentials (Model A) when
 * env vars are present, otherwise fall back to per-merchant credentials.
 */
async function resolveMoncashAdapter(
  supabase: any,
  accountId: string,
  mode: "sandbox" | "live"
): Promise<MonCashAdapter> {
  const envSuffix = mode === "live" ? "LIVE" : "SANDBOX";
  const clientId =
    getEnv(`HAITIPAY_MONCASH_${envSuffix}_CLIENT_ID`) ?? getEnv("HAITIPAY_MONCASH_CLIENT_ID");
  const clientSecret =
    getEnv(`HAITIPAY_MONCASH_${envSuffix}_CLIENT_SECRET`) ?? getEnv("HAITIPAY_MONCASH_CLIENT_SECRET");
  const apiBaseUrl =
    getEnv(`HAITIPAY_MONCASH_${envSuffix}_API_BASE_URL`) ??
    getEnv("HAITIPAY_MONCASH_API_BASE_URL") ??
    defaultApiBaseUrl(mode);
  const gatewayBaseUrl =
    getEnv(`HAITIPAY_MONCASH_${envSuffix}_GATEWAY_BASE_URL`) ??
    getEnv("HAITIPAY_MONCASH_GATEWAY_BASE_URL") ??
    defaultGatewayBaseUrl(mode);

  // Settlement mode (Model A) — use HaitiPay master credentials
  if (clientId && clientSecret) {
    return new MonCashAdapter({
      clientId,
      clientSecret,
      apiBaseUrl,
      gatewayBaseUrl
    });
  }

  // Legacy fallback: per-merchant encrypted credentials
  const { data: credential, error: credentialError } = await supabase
    .from("payment_provider_credentials")
    .select("credentials_ciphertext, nonce")
    .eq("account_id", accountId)
    .maybeSingle();

  if (credentialError || !credential) {
    throw new Error(
      "HaitiPay master MonCash credentials are not configured (HAITIPAY_MONCASH_*) and no per-merchant fallback exists."
    );
  }

  const credentials = await decryptJson<MonCashCredentials>(
    credential.credentials_ciphertext,
    credential.nonce
  );
  return new MonCashAdapter(credentials);
}

/**
 * Returns a MonCash adapter that uses ONLY the HaitiPay master credentials
 * (no per-merchant fallback). Used by the payout cron — payouts are always
 * disbursed from the master wallet.
 */
export function getMasterAdapter(mode: "sandbox" | "live"): MonCashAdapter {
  const envSuffix = mode === "live" ? "LIVE" : "SANDBOX";
  const clientId =
    getEnv(`HAITIPAY_MONCASH_${envSuffix}_CLIENT_ID`) ?? getEnv("HAITIPAY_MONCASH_CLIENT_ID");
  const clientSecret =
    getEnv(`HAITIPAY_MONCASH_${envSuffix}_CLIENT_SECRET`) ?? getEnv("HAITIPAY_MONCASH_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      `HaitiPay master MonCash credentials not configured for ${mode} mode. Set HAITIPAY_MONCASH_CLIENT_ID and HAITIPAY_MONCASH_CLIENT_SECRET in Edge Function Secrets.`
    );
  }

  return new MonCashAdapter({
    clientId,
    clientSecret,
    apiBaseUrl:
      getEnv(`HAITIPAY_MONCASH_${envSuffix}_API_BASE_URL`) ??
      getEnv("HAITIPAY_MONCASH_API_BASE_URL") ??
      defaultApiBaseUrl(mode),
    gatewayBaseUrl:
      getEnv(`HAITIPAY_MONCASH_${envSuffix}_GATEWAY_BASE_URL`) ??
      getEnv("HAITIPAY_MONCASH_GATEWAY_BASE_URL") ??
      defaultGatewayBaseUrl(mode)
  });
}

function defaultApiBaseUrl(mode: "sandbox" | "live") {
  return mode === "live"
    ? "https://moncashbutton.digicelgroup.com/Api"
    : "https://sandbox.moncashbutton.digicelgroup.com/Api";
}

function defaultGatewayBaseUrl(mode: "sandbox" | "live") {
  return mode === "live"
    ? "https://moncashbutton.digicelgroup.com/Moncash-middleware"
    : "https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware";
}
