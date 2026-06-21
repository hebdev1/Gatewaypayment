"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function err(message: string): never {
  redirect(`/dashboard/payouts/destinations?error=${encodeURIComponent(message)}`);
}

export async function addDestinationAction(formData: FormData) {
  const { merchant } = await requireMerchant();

  const mode = String(formData.get("mode") ?? "sandbox");
  const type = String(formData.get("type") ?? "moncash");

  if (mode === "live" && !merchant.live_enabled) err("Live mode is not enabled.");
  if (!["moncash", "bank_account", "cash_pickup"].includes(type)) err("Invalid type.");

  const moncashPhone = String(formData.get("moncash_phone") ?? "").trim() || null;
  const bankName = String(formData.get("bank_name") ?? "").trim() || null;
  const bankAccountNumber = String(formData.get("bank_account_number") ?? "").trim() || null;
  const bankAccountHolder = String(formData.get("bank_account_holder") ?? "").trim() || null;
  const bankSwift = String(formData.get("bank_swift") ?? "").trim() || null;
  const nickname = String(formData.get("nickname") ?? "").trim() || null;
  const setDefault = formData.get("is_default") === "on";

  if (type === "moncash") {
    if (!moncashPhone) err("MonCash phone is required for a MonCash destination.");
    if (!/^[0-9]{8,15}$/.test(moncashPhone)) err("MonCash phone must be 8-15 digits.");
  }
  if (type === "bank_account" && (!bankName || !bankAccountNumber)) {
    err("Bank name and account number are required for a bank destination.");
  }

  const admin = createAdminClient();

  // If we're inserting as default, unset previous default first
  if (setDefault) {
    await admin
      .from("payout_destinations")
      .update({ is_default: false })
      .eq("merchant_id", merchant.id)
      .eq("mode", mode)
      .is("archived_at", null);
  }

  const { error } = await admin.from("payout_destinations").insert({
    merchant_id: merchant.id,
    mode,
    type,
    moncash_phone: type === "moncash" ? moncashPhone : null,
    bank_name: type === "bank_account" ? bankName : null,
    bank_account_number: type === "bank_account" ? bankAccountNumber : null,
    bank_account_holder: type === "bank_account" ? bankAccountHolder : null,
    bank_swift: type === "bank_account" ? bankSwift : null,
    nickname,
    is_default: setDefault
  });

  if (error) err(error.message);

  revalidatePath("/dashboard/payouts/destinations");
  redirect("/dashboard/payouts/destinations?saved=1");
}

export async function setDefaultDestinationAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const destinationId = String(formData.get("destination_id") ?? "");
  if (!destinationId) return;

  const admin = createAdminClient();
  const { data: dest } = await admin
    .from("payout_destinations")
    .select("id, mode")
    .eq("id", destinationId)
    .eq("merchant_id", merchant.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!dest) return;

  await admin
    .from("payout_destinations")
    .update({ is_default: false })
    .eq("merchant_id", merchant.id)
    .eq("mode", dest.mode)
    .is("archived_at", null);

  await admin
    .from("payout_destinations")
    .update({ is_default: true })
    .eq("id", dest.id);

  revalidatePath("/dashboard/payouts/destinations");
}

export async function archiveDestinationAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const destinationId = String(formData.get("destination_id") ?? "");
  if (!destinationId) return;

  const admin = createAdminClient();
  await admin
    .from("payout_destinations")
    .update({ archived_at: new Date().toISOString(), is_default: false })
    .eq("id", destinationId)
    .eq("merchant_id", merchant.id);

  revalidatePath("/dashboard/payouts/destinations");
}
