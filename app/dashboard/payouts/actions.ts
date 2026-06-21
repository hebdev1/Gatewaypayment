"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function err(message: string): never {
  redirect(`/dashboard/payouts?error=${encodeURIComponent(message)}`);
}

export async function saveScheduleAction(formData: FormData) {
  const { merchant } = await requireMerchant();

  const schedule = String(formData.get("payout_schedule") ?? "weekly");
  if (!["manual_only", "daily", "weekly", "monthly"].includes(schedule)) {
    err("Invalid schedule.");
  }

  const dayOfWeek = Math.max(0, Math.min(6, Number(formData.get("payout_day_of_week") ?? 2)));
  const dayOfMonth = Math.max(1, Math.min(28, Number(formData.get("payout_day_of_month") ?? 1)));
  const minAmount = Math.max(0, Number(formData.get("payout_min_amount") ?? 500));
  const autoEnabled = formData.get("auto_payouts_enabled") === "on";

  const admin = createAdminClient();
  const { error } = await admin
    .from("merchants")
    .update({
      payout_schedule: schedule,
      payout_day_of_week: dayOfWeek,
      payout_day_of_month: dayOfMonth,
      payout_min_amount: minAmount,
      auto_payouts_enabled: autoEnabled
    })
    .eq("id", merchant.id);

  if (error) err(error.message);

  revalidatePath("/dashboard/payouts");
  redirect("/dashboard/payouts?saved=1");
}
