"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import { encryptJson, keyPrefix, sha256Hex } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProviderActionState = {
  success?: boolean;
  error?: string;
  inbound_url?: string;
  account_id?: string;
};

export async function saveMoncashCredentialsAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const mode = String(formData.get("mode")) === "live" ? "live" : "sandbox";
  const clientId = String(formData.get("client_id") ?? "").trim();
  const clientSecret = String(formData.get("client_secret") ?? "").trim();
  const apiBaseUrl = String(formData.get("api_base_url") ?? "").trim();
  const gatewayBaseUrl = String(formData.get("gateway_base_url") ?? "").trim();
  const providerFeeBps = Number(formData.get("provider_fee_bps") ?? 0);
  const providerFeeFixed = Number(formData.get("provider_fee_fixed") ?? 0);
  const enabled = formData.get("enabled") === "on";

  const admin = createAdminClient();
  const { data: account, error: accountError } = await admin
    .from("payment_provider_accounts")
    .upsert(
      {
        merchant_id: merchant.id,
        provider: "moncash",
        mode,
        enabled,
        provider_fee_bps: Number.isFinite(providerFeeBps) ? providerFeeBps : 0,
        provider_fee_fixed: Number.isFinite(providerFeeFixed) ? providerFeeFixed : 0,
        metadata: {
          api_base_url: apiBaseUrl,
          gateway_base_url: gatewayBaseUrl
        }
      },
      {
        onConflict: "merchant_id,provider,mode"
      }
    )
    .select("id")
    .single();

  if (accountError) {
    throw new Error(accountError.message);
  }

  if (clientId && clientSecret && apiBaseUrl && gatewayBaseUrl) {
    const encrypted = await encryptJson({
      clientId,
      clientSecret,
      apiBaseUrl,
      gatewayBaseUrl
    });

    const { error: credentialError } = await admin
      .from("payment_provider_credentials")
      .upsert(
        {
          account_id: account.id,
          credentials_ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          key_version: 1,
          updated_at: new Date().toISOString()
        },
        { onConflict: "account_id" }
      );

    if (credentialError) {
      throw new Error(credentialError.message);
    }
  }

  revalidatePath("/dashboard/provider-settings");
}

function functionsBaseUrl() {
  const fromEnv = process.env.SUPABASE_FUNCTIONS_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!fromEnv) {
    throw new Error("Missing SUPABASE_FUNCTIONS_URL.");
  }
  // If only the Supabase project URL is set, derive the functions URL.
  if (fromEnv.includes(".supabase.co") && !fromEnv.includes(".functions.")) {
    return fromEnv.replace(".supabase.co", ".functions.supabase.co").replace(/\/$/, "");
  }
  return fromEnv.replace(/\/$/, "");
}

export async function rotateInboundWebhookTokenAction(
  _previousState: ProviderActionState,
  formData: FormData
): Promise<ProviderActionState> {
  const { merchant } = await requireMerchant();
  const accountId = String(formData.get("account_id") ?? "");

  if (!accountId) {
    return { error: "Missing account id." };
  }

  const admin = createAdminClient();
  const { data: account, error: lookupError } = await admin
    .from("payment_provider_accounts")
    .select("id, merchant_id, provider, mode")
    .eq("id", accountId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (lookupError || !account) {
    return { error: "Provider account not found." };
  }

  const rawToken = randomBytes(24).toString("base64url");
  const tokenHash = sha256Hex(rawToken);

  const { error: updateError } = await admin
    .from("payment_provider_accounts")
    .update({
      inbound_webhook_token_prefix: keyPrefix(rawToken),
      inbound_webhook_token_hash: tokenHash,
      inbound_webhook_token_rotated_at: new Date().toISOString()
    })
    .eq("id", account.id);

  if (updateError) {
    return { error: updateError.message };
  }

  const inboundUrl = `${functionsBaseUrl()}/provider-webhook?account_id=${account.id}&token=${rawToken}`;

  revalidatePath("/dashboard/provider-settings");
  return {
    success: true,
    inbound_url: inboundUrl,
    account_id: account.id
  };
}
