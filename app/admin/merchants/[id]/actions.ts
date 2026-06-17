"use server";

import { revalidatePath } from "next/cache";
import { recordAudit, requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setMerchantStatusAction(formData: FormData) {
  const profile = await requireAdmin();
  const merchantId = String(formData.get("merchant_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!merchantId || !["pending", "active", "suspended"].includes(status)) {
    return;
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("merchants")
    .select("id, status, live_enabled")
    .eq("id", merchantId)
    .maybeSingle();

  if (!before) return;

  const update: Record<string, unknown> = { status };
  if (status === "suspended") {
    update.live_enabled = false;
  }

  await admin.from("merchants").update(update).eq("id", merchantId);

  await recordAudit({
    actorUserId: profile.userId,
    action: `merchant.status.${status}`,
    targetTable: "merchants",
    targetId: merchantId,
    before,
    after: { status, live_enabled: update.live_enabled ?? before.live_enabled },
    notes
  });

  revalidatePath(`/admin/merchants/${merchantId}`);
  revalidatePath("/admin/merchants");
}

export async function toggleLiveModeAction(formData: FormData) {
  const profile = await requireAdmin();
  const merchantId = String(formData.get("merchant_id") ?? "");
  const enabled = String(formData.get("enabled") ?? "false") === "true";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!merchantId) return;

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("merchants")
    .select("id, live_enabled")
    .eq("id", merchantId)
    .maybeSingle();

  if (!before) return;

  await admin
    .from("merchants")
    .update({ live_enabled: enabled })
    .eq("id", merchantId);

  await recordAudit({
    actorUserId: profile.userId,
    action: enabled ? "merchant.live.enabled" : "merchant.live.disabled",
    targetTable: "merchants",
    targetId: merchantId,
    before,
    after: { live_enabled: enabled },
    notes
  });

  revalidatePath(`/admin/merchants/${merchantId}`);
}
