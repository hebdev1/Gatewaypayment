import { sha256Hex } from "../_shared/crypto.ts";
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
  const url = new URL(request.url);
  const accountId = url.searchParams.get("account_id");
  const token = url.searchParams.get("token");

  try {
    // Resolve the provider account up-front when the merchant included it
    // in the callback URL. We use it both to validate the inbound token
    // and to scope the payment lookup.
    let providerAccount:
      | {
          id: string;
          merchant_id: string;
          mode: "sandbox" | "live";
          inbound_webhook_token_hash: string | null;
        }
      | null = null;

    if (accountId) {
      const { data, error } = await supabase
        .from("payment_provider_accounts")
        .select("id, merchant_id, mode, inbound_webhook_token_hash")
        .eq("id", accountId)
        .maybeSingle();

      if (error || !data) {
        return errorResponse("Unknown provider account.", 404, "account_not_found");
      }

      providerAccount = data;

      if (providerAccount.inbound_webhook_token_hash) {
        if (!token) {
          return errorResponse("Missing inbound token.", 401, "inbound_token_missing");
        }

        const providedHash = await sha256Hex(token);
        if (providedHash !== providerAccount.inbound_webhook_token_hash) {
          return errorResponse("Invalid inbound token.", 401, "inbound_token_invalid");
        }
      }
    }

    const body = await readJson<ProviderWebhookBody>(request);
    const providerOrderId = body.payment_id ?? body.orderId ?? body.order_id;
    const transactionId = body.transactionId ?? body.transaction_id;

    let query = supabase
      .from("payments")
      .select("id, merchant_id, mode, provider");

    if (providerAccount) {
      query = query
        .eq("merchant_id", providerAccount.merchant_id)
        .eq("mode", providerAccount.mode);
    }

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

    // Idempotency: skip if we've already recorded a matching inbound event
    // in the last 5 minutes (covers provider retries).
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: recentEvents } = await supabase
      .from("payment_events")
      .select("id")
      .eq("payment_id", payment.id)
      .eq("event_type", "provider.webhook.received")
      .gte("created_at", fiveMinutesAgo)
      .limit(1);

    if (recentEvents?.length) {
      return jsonResponse({ ok: true, duplicate: true });
    }

    await supabase.from("payment_events").insert({
      merchant_id: payment.merchant_id,
      payment_id: payment.id,
      event_type: "provider.webhook.received",
      payload: { body, provider_account_id: providerAccount?.id ?? null }
    });

    const functionsUrl = getEnv("FUNCTIONS_URL") ?? getEnv("SUPABASE_FUNCTIONS_URL");
    const internalSecret = getEnv("INTERNAL_FUNCTION_SECRET");

    if (functionsUrl && internalSecret) {
      // Don't await — return 200 quickly so the provider doesn't retry.
      fetch(`${functionsUrl}/verify-payment`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": internalSecret
        },
        body: JSON.stringify({
          payment_id: payment.id,
          transaction_id: transactionId
        })
      }).catch(() => {
        // Best-effort fire-and-forget; verification can also be re-triggered
        // from the dashboard if needed.
      });
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unexpected error.", 500);
  }
});
