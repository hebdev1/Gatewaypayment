"use server";

import { revalidatePath } from "next/cache";
import { recordAudit, requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

async function decide(
  formData: FormData,
  decision: "approved" | "rejected"
) {
  const profile = await requireAdmin();
  const submissionId = String(formData.get("submission_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!submissionId) return;

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("kyc_submissions")
    .select("id, merchant_id, status")
    .eq("id", submissionId)
    .maybeSingle();

  if (!before || before.status !== "submitted") {
    return;
  }

  await admin
    .from("kyc_submissions")
    .update({
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile.userId,
      notes
    })
    .eq("id", submissionId);

  await recordAudit({
    actorUserId: profile.userId,
    action: `kyc.${decision}`,
    targetTable: "kyc_submissions",
    targetId: submissionId,
    before,
    after: { status: decision, notes },
    notes
  });

  revalidatePath(`/admin/kyc/${submissionId}`);
  revalidatePath("/admin/kyc");
  revalidatePath("/admin");
}

export async function approveKycAction(formData: FormData) {
  await decide(formData, "approved");
}

export async function rejectKycAction(formData: FormData) {
  await decide(formData, "rejected");
}
