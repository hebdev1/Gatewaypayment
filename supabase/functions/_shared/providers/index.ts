import { decryptJson } from "../crypto.ts";
import { MonCashAdapter, type MonCashCredentials } from "./moncash.ts";
import type { PaymentProviderAdapter, ProviderName } from "./types.ts";

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

  const { data: credential, error: credentialError } = await supabase
    .from("payment_provider_credentials")
    .select("credentials_ciphertext, nonce")
    .eq("account_id", account.id)
    .maybeSingle();

  if (credentialError || !credential) {
    throw new Error(`Missing encrypted ${provider} credentials for ${mode} mode.`);
  }

  if (provider === "moncash") {
    const credentials = await decryptJson<MonCashCredentials>(
      credential.credentials_ciphertext,
      credential.nonce
    );

    return {
      adapter: new MonCashAdapter(credentials),
      account
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
