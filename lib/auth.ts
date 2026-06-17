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

  // Defence in depth: explicitly filter by ownership/membership instead
  // of relying solely on RLS. The membership check uses the admin client
  // because RLS on merchant_members may not let the user see rows they
  // don't already own.
  const { data: memberRows } = await createAdminClient()
    .from("merchant_members")
    .select("merchant_id")
    .eq("user_id", userId);

  const memberMerchantIds = (memberRows ?? []).map((row) => row.merchant_id);

  let query = supabase
    .from("merchants")
    .select("id, display_name, status, live_enabled, default_currency, owner_user_id");

  if (memberMerchantIds.length > 0) {
    query = query.or(
      `owner_user_id.eq.${userId},id.in.(${memberMerchantIds.join(",")})`
    );
  } else {
    query = query.eq("owner_user_id", userId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    userId,
    merchant: data
      ? ({
          id: data.id,
          display_name: data.display_name,
          status: data.status,
          live_enabled: data.live_enabled,
          default_currency: data.default_currency
        } as CurrentMerchant)
      : null
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
