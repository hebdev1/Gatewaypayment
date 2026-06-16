"use server";

import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import { encryptJson } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

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
