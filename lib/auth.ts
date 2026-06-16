import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CurrentMerchant = {
  id: string;
  display_name: string;
  status: "pending" | "active" | "suspended";
  live_enabled: boolean;
  default_currency: string;
};

export async function requireUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  return data.claims.sub;
}

export async function getCurrentMerchant() {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("merchants")
    .select("id, display_name, status, live_enabled, default_currency")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    userId,
    merchant: data as CurrentMerchant | null
  };
}

export async function requireMerchant() {
  const current = await getCurrentMerchant();

  if (!current.merchant) {
    redirect("/onboarding");
  }

  return {
    userId: current.userId,
    merchant: current.merchant
  };
}

export async function assertMerchantMember(userId: string, merchantId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("merchant_members")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("You do not have access to this merchant.");
  }
}
