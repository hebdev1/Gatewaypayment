"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function verifyLoginMfaAction(formData: FormData) {
  const factorId = String(formData.get("factor_id") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!factorId || code.length !== 6) {
    redirect("/login/mfa?error=Enter%20the%206-digit%20code.");
  }

  const supabase = await createClient();

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId
  });

  if (challengeError || !challenge) {
    redirect(
      `/login/mfa?error=${encodeURIComponent(challengeError?.message ?? "Could not start challenge.")}`
    );
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code
  });

  if (verifyError) {
    redirect(`/login/mfa?error=${encodeURIComponent(verifyError.message)}`);
  }

  // After verification the user is at AAL2 — route them to the right panel.
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (userId) {
    const admin = createAdminClient();
    const { data: isAdmin } = await admin
      .from("app_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    redirect(isAdmin ? "/admin" : "/dashboard");
  }

  redirect("/dashboard");
}
