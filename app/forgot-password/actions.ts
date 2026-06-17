"use server";

import { redirect } from "next/navigation";
import { publicSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function sendPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/forgot-password?error=Email%20is%20required.");
  }

  const supabase = await createClient();
  const redirectTo = `${publicSiteUrl()}/auth/callback?next=/reset-password`;

  // Always pretend success to avoid leaking which emails exist
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  redirect("/forgot-password?sent=1");
}
