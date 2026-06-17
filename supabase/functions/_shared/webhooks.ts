import { decryptJson, hmacSha256Hex } from "./crypto.ts";

export async function queueEventWebhook(
  supabase: any,
  options: {
    merchantId: string;
    mode: "sandbox" | "live";
    paymentId?: string | null;
    eventType: string;
    data: Record<string, unknown>;
  }
) {
  const { data: endpoints, error } = await supabase
    .from("webhook_endpoints")
    .select("id, merchant_id, mode")
    .eq("merchant_id", options.merchantId)
    .eq("mode", options.mode)
    .eq("enabled", true);

  if (error || !endpoints?.length) {
    return;
  }

  const payload = {
    id: crypto.randomUUID(),
    type: options.eventType,
    created_at: new Date().toISOString(),
    data: options.data
  };

  await supabase.from("webhook_deliveries").insert(
    endpoints.map((endpoint: { id: string; merchant_id: string }) => ({
      merchant_id: endpoint.merchant_id,
      endpoint_id: endpoint.id,
      payment_id: options.paymentId ?? null,
      event_type: options.eventType,
      payload
    }))
  );
}

export async function queuePaymentWebhook(
  supabase: any,
  payment: Record<string, unknown>,
  eventType: string
) {
  await queueEventWebhook(supabase, {
    merchantId: payment.merchant_id as string,
    mode: payment.mode as "sandbox" | "live",
    paymentId: payment.id as string,
    eventType,
    data: { payment }
  });
}

export async function queueRefundWebhook(
  supabase: any,
  refund: Record<string, unknown>,
  payment: Record<string, unknown>,
  eventType: string
) {
  await queueEventWebhook(supabase, {
    merchantId: refund.merchant_id as string,
    mode: refund.mode as "sandbox" | "live",
    paymentId: refund.payment_id as string,
    eventType,
    data: { refund, payment }
  });
}

export async function signWebhookPayload(
  supabase: any,
  endpointId: string,
  payload: unknown
) {
  const { data: secretRow, error } = await supabase
    .from("webhook_endpoint_secrets")
    .select("secret_ciphertext, nonce")
    .eq("endpoint_id", endpointId)
    .maybeSingle();

  if (error || !secretRow) {
    throw new Error("Webhook endpoint secret is missing.");
  }

  const { secret } = await decryptJson<{ secret: string }>(
    secretRow.secret_ciphertext,
    secretRow.nonce
  );
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);
  const signature = await hmacSha256Hex(secret, `${timestamp}.${body}`);

  return {
    body,
    signatureHeader: `t=${timestamp},v1=${signature}`
  };
}
