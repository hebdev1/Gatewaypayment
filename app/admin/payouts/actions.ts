"use server";

import { revalidatePath } from "next/cache";
import { recordAudit, requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function markPayoutCompletedAction(formData: FormData) {
  const profile = await requireAdmin();
  const payoutId = String(formData.get("payout_id") ?? "");
  const reference = String(formData.get("manual_reference") ?? "").trim();
  if (!payoutId || !reference) return;

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("payouts")
    .select("id, status, attempts")
    .eq("id", payoutId)
    .maybeSingle();
  if (!before) return;

  await admin
    .from("payouts")
    .update({
      status: "succeeded",
      manual_completed_by: profile.userId,
      manual_reference: reference,
      completed_at: new Date().toISOString()
    })
    .eq("id", payoutId);

  await recordAudit({
    actorUserId: profile.userId,
    action: "payout.marked_paid_manual",
    targetTable: "payouts",
    targetId: payoutId,
    before,
    after: { status: "succeeded", manual_reference: reference }
  });

  revalidatePath("/admin/payouts");
}

export async function retryPayoutAction(formData: FormData) {
  const profile = await requireAdmin();
  const payoutId = String(formData.get("payout_id") ?? "");
  if (!payoutId) return;

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("payouts")
    .select("id, status, attempts")
    .eq("id", payoutId)
    .maybeSingle();
  if (!before) return;

  await admin
    .from("payouts")
    .update({
      status: "pending",
      scheduled_for: new Date().toISOString(),
      last_error: null
    })
    .eq("id", payoutId);

  await recordAudit({
    actorUserId: profile.userId,
    action: "payout.retry",
    targetTable: "payouts",
    targetId: payoutId,
    before,
    after: { status: "pending", scheduled_for: "now" }
  });

  revalidatePath("/admin/payouts");
}
