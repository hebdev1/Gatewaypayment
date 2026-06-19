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

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type StoredDocument = {
  name: string;
  storage_path: string;
  content_type: string;
  size: number;
  kind?: string;
  uploaded_at: string;
};

function safeName(name: string): string {
  return name
    .replace(/[\\/]/g, "_")
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .slice(-120);
}

async function uploadFiles(
  admin: ReturnType<typeof createAdminClient>,
  merchantId: string,
  files: File[]
): Promise<StoredDocument[]> {
  const uploaded: StoredDocument[] = [];

  for (const file of files) {
    if (!file || !file.name || file.size === 0) continue;
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`${file.name} exceeds the 10 MB limit.`);
    }
    if (!ALLOWED_MIME.has(file.type)) {
      throw new Error(`${file.name}: unsupported type ${file.type}.`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ts = Date.now();
    const path = `${merchantId}/${ts}-${safeName(file.name)}`;

    const { error: uploadError } = await admin.storage
      .from("kyc-documents")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
    }

    uploaded.push({
      name: file.name,
      storage_path: path,
      content_type: file.type,
      size: file.size,
      uploaded_at: new Date().toISOString()
    });
  }

  return uploaded;
}

async function upsertSubmission(
  status: "draft" | "submitted",
  formData: FormData
) {
  const { merchant } = await requireMerchant();

  const businessData: Record<string, string> = {};
  for (const key of FIELDS) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) businessData[key] = value;
  }

  if (status === "submitted") {
    const required = [
      "legal_name",
      "tax_id",
      "business_type",
      "country",
      "city",
      "address",
      "contact_name",
      "contact_phone"
    ];
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

  // Load existing draft (we keep its already-uploaded docs)
  const { data: existing } = await admin
    .from("kyc_submissions")
    .select("id, status, document_urls")
    .eq("merchant_id", merchant.id)
    .in("status", ["draft", "rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Existing docs already stored
  const existingDocs = Array.isArray(existing?.document_urls)
    ? (existing!.document_urls as StoredDocument[])
    : [];

  // Upload any new files from the form
  const newFiles = formData.getAll("documents").filter((v) => v instanceof File) as File[];
  let newlyUploaded: StoredDocument[] = [];
  try {
    newlyUploaded = await uploadFiles(admin, merchant.id, newFiles);
  } catch (e) {
    redirect(
      `/dashboard/kyc?error=${encodeURIComponent(
        e instanceof Error ? e.message : "Upload failed."
      )}`
    );
  }

  const documents = [...existingDocs, ...newlyUploaded];

  const payload = {
    merchant_id: merchant.id,
    status,
    business_data: businessData,
    document_urls: documents,
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

export async function removeKycDocumentAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const path = String(formData.get("path") ?? "");
  if (!path) return;

  const admin = createAdminClient();

  // Make sure the path belongs to this merchant
  if (!path.startsWith(`${merchant.id}/`)) return;

  const { data: existing } = await admin
    .from("kyc_submissions")
    .select("id, document_urls, status")
    .eq("merchant_id", merchant.id)
    .in("status", ["draft", "rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) return;

  const docs = (existing.document_urls ?? []) as StoredDocument[];
  const next = docs.filter((d) => d.storage_path !== path);

  await admin.storage.from("kyc-documents").remove([path]);
  await admin
    .from("kyc_submissions")
    .update({ document_urls: next })
    .eq("id", existing.id);

  revalidatePath("/dashboard/kyc");
}
