import { requireApiKey } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { getProviderAdapter } from "../_shared/providers/index.ts";
import { adminClient } from "../_shared/supabase.ts";
import { queueRefundWebhook } from "../_shared/webhooks.ts";

type CreateRefundBody = {
  payment_id?: string;
  paymentId?: string;
  order_id?: string;
  orderId?: string;
  amount?: number;
  reason?: string;
  merchant_refund_id?: string;
  metadata?: Record<string, unknown>;
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
    const auth = await requireApiKey(request, supabase);
    const body = await readJson<CreateRefundBody>(request);
    const paymentIdRef = body.payment_id ?? body.paymentId;
    const orderIdRef = body.order_id ?? body.orderId;
    const merchantRefundId = body.merchant_refund_id?.trim() || null;

    if (!paymentIdRef && !orderIdRef) {
      return errorResponse("payment_id or order_id is required.");
    }

    let paymentQuery = supabase
      .from("payments")
      .select(
        "id, merchant_id, mode, status, amount_gross, refunded_amount, currency, provider, provider_transaction_id"
      )
      .eq("merchant_id", auth.merchantId)
      .eq("mode", auth.mode);

    if (paymentIdRef) {
      paymentQuery = paymentQuery.eq("id", paymentIdRef);
    } else if (orderIdRef) {
      paymentQuery = paymentQuery.eq("merchant_order_id", orderIdRef);
    }

    const { data: payment, error: paymentError } = await paymentQuery.maybeSingle();

    if (paymentError || !payment) {
      return errorResponse("Payment not found.", 404, "payment_not_found");
    }

    if (payment.status !== "succeeded") {
      return errorResponse(
        `Cannot refund a payment with status ${payment.status}.`,
        409,
        "payment_not_refundable"
      );
    }

    const grossAmount = Number(payment.amount_gross);
    const refundedAmount = Number(payment.refunded_amount ?? 0);
    const remaining = grossAmount - refundedAmount;

    if (remaining <= 0) {
      return errorResponse("Payment has already been fully refunded.", 409, "fully_refunded");
    }

    const requestedAmount = body.amount === undefined ? remaining : Number(body.amount);

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return errorResponse("amount must be greater than zero.");
    }

    if (requestedAmount > remaining) {
      return errorResponse(
        `amount ${requestedAmount} exceeds remaining refundable amount ${remaining}.`,
        400,
        "amount_exceeds_remaining"
      );
    }

    // Idempotency: if a refund with the same merchant_refund_id already exists, return it.
    if (merchantRefundId) {
      const { data: existing } = await supabase
        .from("refunds")
        .select("*")
        .eq("merchant_id", auth.merchantId)
        .eq("mode", auth.mode)
        .eq("merchant_refund_id", merchantRefundId)
        .maybeSingle();

      if (existing) {
        return jsonResponse({ refund: existing, idempotent: true });
      }
    }

    const refundId = crypto.randomUUID();
    const { data: refund, error: insertError } = await supabase
      .from("refunds")
      .insert({
        id: refundId,
        merchant_id: auth.merchantId,
        payment_id: payment.id,
        mode: payment.mode,
        amount: requestedAmount,
        currency: payment.currency,
        reason: body.reason ?? null,
        merchant_refund_id: merchantRefundId,
        metadata: body.metadata ?? {},
        status: "created"
      })
      .select("*")
      .single();

    if (insertError) {
      return errorResponse(insertError.message, 400, "refund_insert_failed");
    }

    let finalStatus: "pending" | "succeeded" | "failed" = "pending";
    let providerRefundId: string | null = null;
    let providerResponse: unknown = {};

    try {
      const { adapter } = await getProviderAdapter(
        supabase,
        payment.merchant_id,
        payment.mode,
        payment.provider
      );

      if (adapter.refundPayment) {
        if (!payment.provider_transaction_id) {
          throw new Error("Payment is missing provider_transaction_id.");
        }

        const result = await adapter.refundPayment({
          providerTransactionId: payment.provider_transaction_id,
          amount: requestedAmount,
          currency: payment.currency,
          reason: body.reason,
          refundId
        });

        finalStatus = result.status;
        providerRefundId = result.providerRefundId ?? null;
        providerResponse = result.raw;
      }
    } catch (providerError) {
      finalStatus = "failed";
      providerResponse = {
        error: providerError instanceof Error ? providerError.message : String(providerError)
      };
    }

    const updatePayload: Record<string, unknown> = {
      status: finalStatus,
      provider_response: providerResponse,
      provider_refund_id: providerRefundId
    };

    if (finalStatus === "succeeded" || finalStatus === "failed") {
      updatePayload.processed_at = new Date().toISOString();
    }

    const { data: updatedRefund } = await supabase
      .from("refunds")
      .update(updatePayload)
      .eq("id", refundId)
      .select("*")
      .single();

    const finalRefund = updatedRefund ?? refund;

    const eventType = `refund.${finalStatus}` as
      | "refund.pending"
      | "refund.succeeded"
      | "refund.failed";

    await supabase.from("payment_events").insert({
      merchant_id: payment.merchant_id,
      payment_id: payment.id,
      event_type: eventType,
      payload: { refund: finalRefund }
    });

    // Re-read the payment to expose the latest refunded_amount in the webhook.
    const { data: refreshedPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment.id)
      .single();

    await queueRefundWebhook(
      supabase,
      finalRefund,
      refreshedPayment ?? payment,
      eventType
    );

    return jsonResponse({ refund: finalRefund });
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
