"use server";

import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type RefundActionState = {
  success?: boolean;
  error?: string;
};

async function queueRefundWebhook(
  admin: ReturnType<typeof createAdminClient>,
  refund: {
    id: string;
    merchant_id: string;
    payment_id: string;
    mode: string;
  },
  eventType: string
) {
  const { data: endpoints } = await admin
    .from("webhook_endpoints")
    .select("id")
    .eq("merchant_id", refund.merchant_id)
    .eq("mode", refund.mode)
    .eq("enabled", true);

  if (!endpoints?.length) return;

  const { data: refundRow } = await admin
    .from("refunds")
    .select("*")
    .eq("id", refund.id)
    .single();

  const { data: paymentRow } = await admin
    .from("payments")
    .select("*")
    .eq("id", refund.payment_id)
    .single();

  const payload = {
    id: crypto.randomUUID(),
    type: eventType,
    created_at: new Date().toISOString(),
    data: { refund: refundRow, payment: paymentRow }
  };

  await admin.from("webhook_deliveries").insert(
    endpoints.map((endpoint) => ({
      merchant_id: refund.merchant_id,
      endpoint_id: endpoint.id,
      payment_id: refund.payment_id,
      event_type: eventType,
      payload
    }))
  );
}

export async function createRefundAction(
  _previousState: RefundActionState,
  formData: FormData
): Promise<RefundActionState> {
  const { merchant } = await requireMerchant();
  const paymentId = String(formData.get("payment_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const amount = Number(amountRaw);

  if (!paymentId) {
    return { error: "Missing payment id." };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be greater than zero." };
  }

  const admin = createAdminClient();
  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("id, merchant_id, mode, status, currency, amount_gross, refunded_amount")
    .eq("id", paymentId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (paymentError || !payment) {
    return { error: "Payment not found." };
  }

  if (payment.status !== "succeeded") {
    return { error: `Cannot refund a payment with status ${payment.status}.` };
  }

  const remaining = Number(payment.amount_gross) - Number(payment.refunded_amount ?? 0);
  if (amount > remaining) {
    return { error: `Amount exceeds remaining refundable balance (${remaining}).` };
  }

  const refundId = crypto.randomUUID();
  const { data: refund, error: insertError } = await admin
    .from("refunds")
    .insert({
      id: refundId,
      merchant_id: merchant.id,
      payment_id: payment.id,
      mode: payment.mode,
      amount,
      currency: payment.currency,
      reason,
      status: "pending"
    })
    .select("id, merchant_id, payment_id, mode")
    .single();

  if (insertError) {
    return { error: insertError.message };
  }

  await admin.from("payment_events").insert({
    merchant_id: merchant.id,
    payment_id: payment.id,
    event_type: "refund.pending",
    payload: { refund }
  });

  await queueRefundWebhook(admin, refund, "refund.pending");

  revalidatePath(`/dashboard/payments/${payment.id}`);
  revalidatePath(`/dashboard/refunds`);
  return { success: true };
}

async function updateRefundStatus(
  refundId: string,
  status: "succeeded" | "failed"
) {
  const { merchant } = await requireMerchant();
  const admin = createAdminClient();

  const { data: refund, error: lookupError } = await admin
    .from("refunds")
    .select("id, merchant_id, payment_id, mode")
    .eq("id", refundId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (lookupError || !refund) {
    return;
  }

  await admin
    .from("refunds")
    .update({
      status,
      processed_at: new Date().toISOString()
    })
    .eq("id", refund.id);

  await admin.from("payment_events").insert({
    merchant_id: merchant.id,
    payment_id: refund.payment_id,
    event_type: `refund.${status}`,
    payload: { refund_id: refund.id, status }
  });

  await queueRefundWebhook(admin, refund, `refund.${status}`);

  revalidatePath(`/dashboard/payments/${refund.payment_id}`);
  revalidatePath(`/dashboard/refunds`);
}

export async function markRefundCompletedAction(formData: FormData) {
  const refundId = String(formData.get("refund_id") ?? "");
  if (!refundId) return;
  await updateRefundStatus(refundId, "succeeded");
}

export async function markRefundFailedAction(formData: FormData) {
  const refundId = String(formData.get("refund_id") ?? "");
  if (!refundId) return;
  await updateRefundStatus(refundId, "failed");
}
