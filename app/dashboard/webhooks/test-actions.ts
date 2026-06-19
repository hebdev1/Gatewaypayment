"use server";

import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type TestState = { queued?: boolean; error?: string };

export async function sendTestWebhookAction(
  _prevState: TestState,
  formData: FormData
): Promise<TestState> {
  const { merchant } = await requireMerchant();
  const endpointId = String(formData.get("endpoint_id") ?? "");
  const eventType = String(formData.get("event_type") ?? "payment.succeeded");

  if (!endpointId) return { error: "Choose an endpoint." };

  const admin = createAdminClient();

  const { data: endpoint } = await admin
    .from("webhook_endpoints")
    .select("id, merchant_id, mode")
    .eq("id", endpointId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (!endpoint) return { error: "Endpoint not found." };

  const payload = {
    id: crypto.randomUUID(),
    type: eventType,
    created_at: new Date().toISOString(),
    livemode: endpoint.mode === "live",
    data: {
      test: true,
      payment: {
        id: crypto.randomUUID(),
        amount_gross: "1000.00",
        currency: "HTG",
        status: eventType.startsWith("payment.")
          ? eventType.split(".")[1]
          : "succeeded",
        merchant_order_id: "TEST-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        mode: endpoint.mode
      }
    }
  };

  const { error } = await admin.from("webhook_deliveries").insert({
    merchant_id: merchant.id,
    endpoint_id: endpoint.id,
    event_type: eventType,
    payload,
    status: "pending",
    next_attempt_at: new Date().toISOString()
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/webhooks");
  return { queued: true };
}
