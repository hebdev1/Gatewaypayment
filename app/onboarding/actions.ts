"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createMerchantAction(formData: FormData) {
  const userId = await requireUserId();
  const supabase = await createClient();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const legalName = String(formData.get("legal_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .insert({
      owner_user_id: userId,
      display_name: displayName,
      legal_name: legalName || null,
      email: email || null,
      phone: phone || null,
      status: "active"
    })
    .select("id")
    .single();

  if (merchantError) {
    redirect(`/onboarding?error=${encodeURIComponent(merchantError.message)}`);
  }

  const { error: memberError } = await supabase.from("merchant_members").insert({
    merchant_id: merchant.id,
    user_id: userId,
    role: "owner"
  });

  if (memberError) {
    redirect(`/onboarding?error=${encodeURIComponent(memberError.message)}`);
  }

  redirect("/dashboard");
}
