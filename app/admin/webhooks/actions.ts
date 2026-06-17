"use server";

import { revalidatePath } from "next/cache";
import { recordAudit, requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function retryDeliveryAction(formData: FormData) {
  const profile = await requireAdmin();
  const deliveryId = String(formData.get("delivery_id") ?? "");
  if (!deliveryId) return;

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("webhook_deliveries")
    .select("id, status, attempts, next_attempt_at")
    .eq("id", deliveryId)
    .maybeSingle();

  if (!before) return;

  // Reset the delivery so the next cron tick picks it up.
  await admin
    .from("webhook_deliveries")
    .update({
      status: "pending",
      next_attempt_at: new Date().toISOString(),
      last_error: null
    })
    .eq("id", deliveryId);

  await recordAudit({
    actorUserId: profile.userId,
    action: "webhook.delivery.retry",
    targetTable: "webhook_deliveries",
    targetId: deliveryId,
    before,
    after: { status: "pending", next_attempt_at: "now" }
  });

  revalidatePath("/admin/webhooks");
}
