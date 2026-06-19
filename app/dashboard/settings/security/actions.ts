"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function err(message: string): never {
  redirect(`/dashboard/settings/security?error=${encodeURIComponent(message)}`);
}

export async function enrollTotpAction(): Promise<{
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}> {
  await requireUserId();
  const supabase = await createClient();

  // Clean up any previous unverified factors
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.totp ?? []) {
    if (f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator (${new Date().toLocaleDateString()})`
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Could not enroll factor.");
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri
  };
}

export async function verifyTotpEnrollmentAction(
  _prevState: { error?: string; verified?: boolean },
  formData: FormData
): Promise<{ error?: string; verified?: boolean }> {
  await requireUserId();
  const factorId = String(formData.get("factor_id") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!factorId || code.length < 6) {
    return { error: "Enter the 6-digit code from your authenticator." };
  }

  const supabase = await createClient();

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId
  });
  if (challengeError || !challenge) {
    return { error: challengeError?.message ?? "Could not start challenge." };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code
  });

  if (verifyError) {
    return { error: verifyError.message };
  }

  revalidatePath("/dashboard/settings/security");
  return { verified: true };
}

export async function unenrollFactorAction(formData: FormData) {
  await requireUserId();
  const factorId = String(formData.get("factor_id") ?? "");
  if (!factorId) return;

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });

  if (error) {
    err(error.message);
  }

  revalidatePath("/dashboard/settings/security");
}
