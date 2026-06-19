"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/payment-utils";

function err(message: string): never {
  redirect(`/dashboard/links/new?error=${encodeURIComponent(message)}`);
}

export async function createPaymentLinkAction(formData: FormData) {
  const { merchant } = await requireMerchant();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const mode = String(formData.get("mode") ?? "sandbox") === "live" ? "live" : "sandbox";

  if (mode === "live" && !merchant.live_enabled) {
    err("Live mode is not enabled for this merchant.");
  }

  const currency = String(formData.get("currency") ?? "HTG").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) err("Invalid currency code.");

  const allowCustom = formData.get("allow_custom_amount") === "on";
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw ? Number(amountRaw) : null;
  const minAmount = String(formData.get("min_amount") ?? "").trim();
  const maxAmount = String(formData.get("max_amount") ?? "").trim();
  const maxUsesRaw = String(formData.get("max_uses") ?? "").trim();
  const successUrl = String(formData.get("success_url") ?? "").trim() || null;
  const expiresRaw = String(formData.get("expires_at") ?? "").trim();

  if (!name) err("Name is required.");

  if (!allowCustom && (amount === null || !Number.isFinite(amount) || amount <= 0)) {
    err("Set either a fixed amount or enable custom amount.");
  }

  const admin = createAdminClient();

  const payload = {
    merchant_id: merchant.id,
    mode,
    slug: generateSlug(),
    name,
    description,
    amount: allowCustom ? null : amount,
    currency,
    allow_custom_amount: allowCustom,
    min_amount: allowCustom && minAmount ? Number(minAmount) : null,
    max_amount: allowCustom && maxAmount ? Number(maxAmount) : null,
    max_uses: maxUsesRaw ? Number(maxUsesRaw) : null,
    collect_customer_email: formData.get("collect_customer_email") === "on",
    collect_customer_phone: formData.get("collect_customer_phone") === "on",
    collect_customer_name: formData.get("collect_customer_name") === "on",
    success_url: successUrl,
    expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
    status: "active" as const
  };

  const { data, error } = await admin
    .from("payment_links")
    .insert(payload)
    .select("id")
    .single();

  if (error) err(error.message);

  revalidatePath("/dashboard/links");
  redirect(`/dashboard/links/${data!.id}`);
}

export async function archivePaymentLinkAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const linkId = String(formData.get("link_id") ?? "");
  if (!linkId) return;

  const admin = createAdminClient();
  await admin
    .from("payment_links")
    .update({ status: "archived" })
    .eq("id", linkId)
    .eq("merchant_id", merchant.id);

  revalidatePath(`/dashboard/links/${linkId}`);
  revalidatePath("/dashboard/links");
}

export async function reactivatePaymentLinkAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const linkId = String(formData.get("link_id") ?? "");
  if (!linkId) return;

  const admin = createAdminClient();
  await admin
    .from("payment_links")
    .update({ status: "active" })
    .eq("id", linkId)
    .eq("merchant_id", merchant.id);

  revalidatePath(`/dashboard/links/${linkId}`);
  revalidatePath("/dashboard/links");
}
