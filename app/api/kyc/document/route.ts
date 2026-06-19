import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Returns a 5-minute signed URL for a KYC document. Auth: the requester
// must be either an admin or a member of the merchant that owns the path.
export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Owner / member check or admin
  const folder = path.split("/")[0];
  if (!folder) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const { data: isAdmin } = await admin
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!isAdmin) {
    const { data: membership } = await admin
      .from("merchant_members")
      .select("merchant_id")
      .eq("user_id", userId)
      .eq("merchant_id", folder)
      .maybeSingle();
    const { data: ownership } = await admin
      .from("merchants")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("id", folder)
      .maybeSingle();
    if (!membership && !ownership) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  const { data: signed, error } = await admin.storage
    .from("kyc-documents")
    .createSignedUrl(path, 300);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Could not sign URL" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
