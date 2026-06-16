import { authorizeInternalOrApiKey } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { getProviderAdapter } from "../_shared/providers/index.ts";
import { adminClient } from "../_shared/supabase.ts";
import { queuePaymentWebhook } from "../_shared/webhooks.ts";

type VerifyPaymentBody = {
  payment_id?: string;
  order_id?: string;
  orderId?: string;
  transaction_id?: string;
  transactionId?: string;
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
    const authorization = await authorizeInternalOrApiKey(request, supabase);
    const body = await readJson<VerifyPaymentBody>(request);
    const paymentId = body.payment_id;
    const orderId = body.orderId ?? body.order_id;
    const transactionId = body.transactionId ?? body.transaction_id;

    let query = supabase.from("payments").select("*");

    if (paymentId) {
      query = query.eq("id", paymentId);
    } else if (orderId) {
      query = query.eq("merchant_order_id", orderId);
    } else if (transactionId) {
      query = query.eq("provider_transaction_id", transactionId);
    } else {
      return errorResponse("payment_id, order_id, or transaction_id is required.");
    }

    if (!authorization.internal) {
      query = query.eq("merchant_id", authorization.apiKey.merchantId);
    }

    const { data: payment, error: paymentError } = await query.maybeSingle();

    if (paymentError || !payment) {
      return errorResponse("Payment not found.", 404, "payment_not_found");
    }

    const { adapter } = await getProviderAdapter(
      supabase,
      payment.merchant_id,
      payment.mode,
      payment.provider
    );

    const previousStatus = payment.status;
    const verification = await adapter.verifyPayment({
      orderId: payment.provider_order_id ?? payment.id,
      transactionId
    });

    const update: Record<string, unknown> = {
      status: verification.status,
      provider_response: verification.raw
    };

    if (verification.providerTransactionId) {
      update.provider_transaction_id = verification.providerTransactionId;
    }

    if (verification.status === "succeeded" && previousStatus !== "succeeded") {
      update.paid_at = new Date().toISOString();
    }

    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update(update)
      .eq("id", payment.id)
      .select("*")
      .single();

    if (updateError) {
      return errorResponse(updateError.message, 500, "payment_update_failed");
    }

    if (previousStatus !== verification.status) {
      const eventType =
        verification.status === "succeeded"
          ? "payment.succeeded"
          : `payment.${verification.status}`;

      await supabase.from("payment_events").insert({
        merchant_id: payment.merchant_id,
        payment_id: payment.id,
        event_type: eventType,
        payload: updatedPayment
      });

      await queuePaymentWebhook(supabase, updatedPayment, eventType);
    }

    return jsonResponse({
      ok: true,
      payment: updatedPayment
    });
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
