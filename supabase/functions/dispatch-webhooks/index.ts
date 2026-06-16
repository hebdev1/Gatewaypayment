import { requireInternalSecret } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { signWebhookPayload } from "../_shared/webhooks.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed.", 405, "method_not_allowed");
  }

  const supabase = adminClient();

  try {
    requireInternalSecret(request);

    const { data: deliveries, error } = await supabase
      .from("webhook_deliveries")
      .select("id, endpoint_id, payload, attempts, webhook_endpoints(url, enabled)")
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(25);

    if (error) {
      return errorResponse(error.message, 500, "delivery_lookup_failed");
    }

    const results = [];

    for (const delivery of deliveries ?? []) {
      const endpoint = Array.isArray(delivery.webhook_endpoints)
        ? delivery.webhook_endpoints[0]
        : delivery.webhook_endpoints;

      if (!endpoint?.enabled) {
        continue;
      }

      await supabase
        .from("webhook_deliveries")
        .update({ status: "sending" })
        .eq("id", delivery.id);

      try {
        const signed = await signWebhookPayload(
          supabase,
          delivery.endpoint_id,
          delivery.payload
        );
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "HaitiPay-Webhooks/0.1",
            "x-haitipay-event": delivery.payload?.type ?? "payment.event",
            "x-haitipay-signature": signed.signatureHeader
          },
          body: signed.body
        });

        const succeeded = response.status >= 200 && response.status < 300;

        await supabase
          .from("webhook_deliveries")
          .update({
            status: succeeded ? "succeeded" : "failed",
            attempts: delivery.attempts + 1,
            response_status: response.status,
            last_error: succeeded ? null : await response.text().catch(() => "delivery failed"),
            next_attempt_at: new Date(
              Date.now() + Math.min(60, 2 ** delivery.attempts) * 60_000
            ).toISOString()
          })
          .eq("id", delivery.id);

        results.push({ id: delivery.id, status: response.status });
      } catch (deliveryError) {
        await supabase
          .from("webhook_deliveries")
          .update({
            status: "failed",
            attempts: delivery.attempts + 1,
            last_error:
              deliveryError instanceof Error ? deliveryError.message : String(deliveryError),
            next_attempt_at: new Date(
              Date.now() + Math.min(60, 2 ** delivery.attempts) * 60_000
            ).toISOString()
          })
          .eq("id", delivery.id);

        results.push({ id: delivery.id, status: "failed" });
      }
    }

    return jsonResponse({ processed: results.length, results });
  } catch (error) {
    if (error instanceof Response) {
      return new Response(error.body, {
        status: error.status,
        headers: corsHeaders
      });
    }

    return errorResponse(error instanceof Error ? error.message : "Unexpected error.", 500);
  }
});
