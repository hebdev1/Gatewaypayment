import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { getEnv } from "../_shared/env.ts";
import { adminClient } from "../_shared/supabase.ts";

type ProviderWebhookBody = {
  orderId?: string;
  order_id?: string;
  transactionId?: string;
  transaction_id?: string;
  payment_id?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed.", 405, "method_not_allowed");
  }

  const supabase = adminClient();

  try {
    const body = await readJson<ProviderWebhookBody>(request);
    const providerOrderId = body.payment_id ?? body.orderId ?? body.order_id;
    const transactionId = body.transactionId ?? body.transaction_id;

    let query = supabase.from("payments").select("id, merchant_id");

    if (providerOrderId) {
      query = query.eq("provider_order_id", providerOrderId);
    } else if (transactionId) {
      query = query.eq("provider_transaction_id", transactionId);
    } else {
      return errorResponse("orderId or transactionId is required.");
    }

    const { data: payment, error } = await query.maybeSingle();

    if (error || !payment) {
      return errorResponse("Payment not found.", 404, "payment_not_found");
    }

    await supabase.from("payment_events").insert({
      merchant_id: payment.merchant_id,
      payment_id: payment.id,
      event_type: "provider.webhook.received",
      payload: body
    });

    const functionsUrl = getEnv("FUNCTIONS_URL") ?? getEnv("SUPABASE_FUNCTIONS_URL");
    const internalSecret = getEnv("INTERNAL_FUNCTION_SECRET");

    if (functionsUrl && internalSecret) {
      await fetch(`${functionsUrl}/verify-payment`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": internalSecret
        },
        body: JSON.stringify({
          payment_id: payment.id,
          transaction_id: transactionId
        })
      });
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unexpected error.", 500);
  }
});
