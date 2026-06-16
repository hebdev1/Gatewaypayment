"use server";

import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import { generateApiKey, keyPrefix, lastFour, sha256Hex } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

type ApiKeyState = {
  apiKey?: string;
  error?: string;
};

export async function createApiKeyAction(
  _previousState: ApiKeyState,
  formData: FormData
): Promise<ApiKeyState> {
  const { merchant } = await requireMerchant();
  const mode = String(formData.get("mode")) === "live" ? "live" : "sandbox";
  const name = String(formData.get("name") ?? "Default key").trim();

  if (mode === "live" && !merchant.live_enabled) {
    return { error: "Live mode is not enabled for this merchant." };
  }

  const apiKey = generateApiKey(mode);
  const admin = createAdminClient();

  const { data: keyRow, error: keyError } = await admin
    .from("api_keys")
    .insert({
      merchant_id: merchant.id,
      mode,
      name,
      prefix: keyPrefix(apiKey),
      last_four: lastFour(apiKey)
    })
    .select("id")
    .single();

  if (keyError) {
    return { error: keyError.message };
  }

  const { error: secretError } = await admin.from("api_key_secrets").insert({
    api_key_id: keyRow.id,
    key_hash: sha256Hex(apiKey)
  });

  if (secretError) {
    return { error: secretError.message };
  }

  revalidatePath("/dashboard/api-keys");
  return { apiKey };
}

export async function revokeApiKeyAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const keyId = String(formData.get("key_id") ?? "");
  const admin = createAdminClient();

  await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("merchant_id", merchant.id);

  revalidatePath("/dashboard/api-keys");
}
