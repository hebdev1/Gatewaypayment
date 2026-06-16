"use server";

import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import { encryptJson, generateWebhookSecret } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

type WebhookState = {
  secret?: string;
  error?: string;
};

export async function createWebhookEndpointAction(
  _previousState: WebhookState,
  formData: FormData
): Promise<WebhookState> {
  const { merchant } = await requireMerchant();
  const mode = String(formData.get("mode")) === "live" ? "live" : "sandbox";
  const url = String(formData.get("url") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const secret = generateWebhookSecret();
  const encrypted = await encryptJson({ secret });
  const admin = createAdminClient();

  const { data: endpoint, error: endpointError } = await admin
    .from("webhook_endpoints")
    .insert({
      merchant_id: merchant.id,
      mode,
      url,
      description: description || null,
      enabled: true
    })
    .select("id")
    .single();

  if (endpointError) {
    return { error: endpointError.message };
  }

  const { error: secretError } = await admin.from("webhook_endpoint_secrets").insert({
    endpoint_id: endpoint.id,
    secret_ciphertext: encrypted.ciphertext,
    nonce: encrypted.nonce
  });

  if (secretError) {
    return { error: secretError.message };
  }

  revalidatePath("/dashboard/webhooks");
  return { secret };
}

export async function disableWebhookEndpointAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const endpointId = String(formData.get("endpoint_id") ?? "");
  const admin = createAdminClient();

  await admin
    .from("webhook_endpoints")
    .update({ enabled: false })
    .eq("id", endpointId)
    .eq("merchant_id", merchant.id);

  revalidatePath("/dashboard/webhooks");
}
