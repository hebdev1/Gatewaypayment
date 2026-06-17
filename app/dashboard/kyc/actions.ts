"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const FIELDS = [
  "legal_name",
  "tax_id",
  "business_type",
  "industry",
  "country",
  "city",
  "address",
  "contact_name",
  "contact_phone"
] as const;

function buildPayload(formData: FormData) {
  const businessData: Record<string, string> = {};
  for (const key of FIELDS) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) businessData[key] = value;
  }
  const rawUrls = String(formData.get("document_urls") ?? "");
  const documentUrls = rawUrls
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
  return { businessData, documentUrls };
}

async function upsertSubmission(
  status: "draft" | "submitted",
  formData: FormData
) {
  const { merchant } = await requireMerchant();
  const { businessData, documentUrls } = buildPayload(formData);

  if (status === "submitted") {
    const required = ["legal_name", "tax_id", "business_type", "country", "city", "address", "contact_name", "contact_phone"];
    const missing = required.filter((key) => !businessData[key]);
    if (missing.length) {
      redirect(
        `/dashboard/kyc?error=${encodeURIComponent(
          `Missing required fields: ${missing.join(", ")}`
        )}`
      );
    }
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("kyc_submissions")
    .select("id, status")
    .eq("merchant_id", merchant.id)
    .in("status", ["draft", "rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    merchant_id: merchant.id,
    status,
    business_data: businessData,
    document_urls: documentUrls,
    submitted_at: status === "submitted" ? new Date().toISOString() : null,
    notes: null
  };

  if (existing) {
    const { error } = await admin
      .from("kyc_submissions")
      .update(payload)
      .eq("id", existing.id);
    if (error) {
      redirect(`/dashboard/kyc?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    const { error } = await admin.from("kyc_submissions").insert(payload);
    if (error) {
      redirect(`/dashboard/kyc?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath("/dashboard/kyc");
  redirect(status === "submitted" ? "/dashboard/kyc?submitted=1" : "/dashboard/kyc?saved=1");
}

export async function saveDraftAction(formData: FormData) {
  await upsertSubmission("draft", formData);
}

export async function submitKycAction(formData: FormData) {
  await upsertSubmission("submitted", formData);
}
