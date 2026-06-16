import { requireApiKey } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { getEnv } from "../_shared/env.ts";
import { calculatePaymentAmounts, GATEWAY_FEE_BPS } from "../_shared/money.ts";
import { getProviderAdapter } from "../_shared/providers/index.ts";
import { adminClient } from "../_shared/supabase.ts";

type CreatePaymentBody = {
  amount: number;
  currency?: string;
  orderId?: string;
  order_id?: string;
  provider?: "moncash";
  customer?: {
    email?: string;
    phone?: string;
  };
  description?: string;
  success_url?: string;
  cancel_url?: string;
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
    const body = await readJson<CreatePaymentBody>(request);
    const amount = Number(body.amount);
    const orderId = String(body.orderId ?? body.order_id ?? "").trim();
    const provider = body.provider ?? "moncash";
    const currency = (body.currency ?? "HTG").toUpperCase();

    if (!Number.isFinite(amount) || amount <= 0) {
      return errorResponse("amount must be greater than zero.");
    }

    if (!orderId) {
      return errorResponse("orderId is required.");
    }

    if (currency.length !== 3) {
      return errorResponse("currency must be a 3-letter ISO code.");
    }

    const { data: existing } = await supabase
      .from("payments")
      .select("*")
      .eq("merchant_id", auth.merchantId)
      .eq("mode", auth.mode)
      .eq("merchant_order_id", orderId)
      .maybeSingle();

    if (existing) {
      return jsonResponse({
        payment: existing,
        checkout_url: existing.hosted_checkout_url,
        provider_checkout_url: existing.provider_checkout_url,
        idempotent: true
      });
    }

    const { adapter, account } = await getProviderAdapter(
      supabase,
      auth.merchantId,
      auth.mode,
      provider
    );
    const { gatewayFee, providerFee, merchantNet } = calculatePaymentAmounts(
      amount,
      account.provider_fee_bps,
      Number(account.provider_fee_fixed)
    );

    if (merchantNet < 0) {
      return errorResponse("Fees exceed the gross amount.");
    }

    const paymentId = crypto.randomUUID();
    const hostedCheckoutUrl = `${getEnv("PUBLIC_SITE_URL") ?? "http://localhost:3000"}/checkout/${paymentId}`;

    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert({
        id: paymentId,
        merchant_id: auth.merchantId,
        provider,
        mode: auth.mode,
        status: "created",
        merchant_order_id: orderId,
        provider_order_id: paymentId,
        hosted_checkout_url: hostedCheckoutUrl,
        amount_gross: amount,
        gateway_fee_bps: GATEWAY_FEE_BPS,
        gateway_fee_amount: gatewayFee,
        provider_fee_amount: providerFee,
        merchant_net_amount: merchantNet,
        currency,
        customer_email: body.customer?.email ?? null,
        customer_phone: body.customer?.phone ?? null,
        description: body.description ?? null,
        success_url: body.success_url ?? null,
        cancel_url: body.cancel_url ?? null,
        metadata: body.metadata ?? {}
      })
      .select("*")
      .single();

    if (insertError) {
      return errorResponse(insertError.message, 400, "payment_insert_failed");
    }

    try {
      const providerPayment = await adapter.createPayment({
        amount,
        currency,
        orderId: paymentId
      });

      const { data: updatedPayment, error: updateError } = await supabase
        .from("payments")
        .update({
          status: "pending",
          provider_payment_token: providerPayment.providerPaymentToken,
          provider_checkout_url: providerPayment.providerCheckoutUrl,
          provider_response: providerPayment.raw
        })
        .eq("id", paymentId)
        .select("*")
        .single();

      if (updateError) {
        return errorResponse(updateError.message, 500, "payment_update_failed");
      }

      await supabase.from("payment_events").insert({
        merchant_id: auth.merchantId,
        payment_id: paymentId,
        event_type: "payment.created",
        payload: updatedPayment
      });

      return jsonResponse({
        payment: updatedPayment,
        checkout_url: hostedCheckoutUrl,
        provider_checkout_url: providerPayment.providerCheckoutUrl
      });
    } catch (providerError) {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          provider_response: {
            error: providerError instanceof Error ? providerError.message : String(providerError)
          }
        })
        .eq("id", payment.id);

      return errorResponse(
        providerError instanceof Error ? providerError.message : "Provider payment failed.",
        502,
        "provider_create_failed"
      );
    }
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
