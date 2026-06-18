"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMerchant, requireUserId } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function errorRedirect(message: string) {
  redirect(`/dashboard/settings?error=${encodeURIComponent(message)}`);
}

export async function updateBusinessProfileAction(formData: FormData) {
  const { merchant } = await requireMerchant();

  const displayName = String(formData.get("display_name") ?? "").trim();
  const legalName = String(formData.get("legal_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const countryCode = String(formData.get("country_code") ?? "").trim().toUpperCase();
  const defaultCurrency = String(formData.get("default_currency") ?? "").trim().toUpperCase();

  if (!displayName) {
    errorRedirect("Display name is required.");
  }

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    errorRedirect("Country code must be a 2-letter ISO code (e.g. HT).");
  }

  if (!/^[A-Z]{3}$/.test(defaultCurrency)) {
    errorRedirect("Default currency must be a 3-letter ISO code (e.g. HTG).");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("merchants")
    .update({
      display_name: displayName,
      legal_name: legalName || null,
      email: email || null,
      phone: phone || null,
      country_code: countryCode,
      default_currency: defaultCurrency
    })
    .eq("id", merchant.id);

  if (error) {
    errorRedirect(error.message);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  redirect("/dashboard/settings?profile=1");
}

export async function updatePasswordAction(formData: FormData) {
  const userId = await requireUserId();
  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (newPassword.length < 8) {
    errorRedirect("New password must be at least 8 characters.");
  }

  if (newPassword !== confirm) {
    errorRedirect("New passwords don't match.");
  }

  if (currentPassword === newPassword) {
    errorRedirect("New password must be different from the current one.");
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const email = userResult.user?.email;
  if (!email) {
    errorRedirect("Could not determine current email.");
  }

  // Verify current password by attempting a fresh sign-in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email as string,
    password: currentPassword
  });

  if (signInError) {
    errorRedirect("Current password is incorrect.");
  }

  // Replace it
  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword
  });

  if (updateError) {
    errorRedirect(updateError.message);
  }

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?password=1");
}

export async function addTeamMemberAction(formData: FormData) {
  const userId = await requireUserId();
  const { merchant } = await requireMerchant();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "developer");

  if (!email) {
    errorRedirect("Email is required.");
  }

  if (!["admin", "developer", "viewer"].includes(role)) {
    errorRedirect("Invalid role.");
  }

  const admin = createAdminClient();

  // Owner check
  const { data: myMembership } = await admin
    .from("merchant_members")
    .select("role")
    .eq("merchant_id", merchant.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (myMembership?.role !== "owner") {
    errorRedirect("Only the owner can add team members.");
  }

  // Find user by email
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list?.users?.find((u) => u.email?.toLowerCase() === email);

  if (!found) {
    errorRedirect(
      `No HaitiPay account found for ${email}. Ask them to sign up first.`
    );
  }

  // Check duplicate
  const { data: existing } = await admin
    .from("merchant_members")
    .select("user_id")
    .eq("merchant_id", merchant.id)
    .eq("user_id", found!.id)
    .maybeSingle();

  if (existing) {
    errorRedirect("This user is already a member.");
  }

  const { error } = await admin.from("merchant_members").insert({
    merchant_id: merchant.id,
    user_id: found!.id,
    role
  });

  if (error) {
    errorRedirect(error.message);
  }

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?team=1");
}

export async function removeTeamMemberAction(formData: FormData) {
  const userId = await requireUserId();
  const { merchant } = await requireMerchant();
  const targetUserId = String(formData.get("user_id") ?? "");

  if (!targetUserId) return;

  const admin = createAdminClient();

  // Owner check
  const { data: myMembership } = await admin
    .from("merchant_members")
    .select("role")
    .eq("merchant_id", merchant.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (myMembership?.role !== "owner") {
    errorRedirect("Only the owner can remove team members.");
  }

  // Cannot remove yourself, cannot remove another owner
  if (targetUserId === userId) {
    errorRedirect("You can't remove yourself.");
  }

  const { data: target } = await admin
    .from("merchant_members")
    .select("role")
    .eq("merchant_id", merchant.id)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!target) {
    errorRedirect("Member not found.");
  }

  if (target?.role === "owner") {
    errorRedirect("Cannot remove an owner. Transfer ownership first.");
  }

  await admin
    .from("merchant_members")
    .delete()
    .eq("merchant_id", merchant.id)
    .eq("user_id", targetUserId);

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?team=1");
}

export async function signOutEverywhereAction() {
  const userId = await requireUserId();
  const admin = createAdminClient();
  // signOut("global") in the Supabase admin client invalidates every refresh
  // token for the user.
  await admin.auth.admin.signOut(userId, "global");
  redirect("/login");
}
