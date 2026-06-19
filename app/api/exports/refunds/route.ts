import { NextResponse, type NextRequest } from "next/server";
import { requireMerchant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { merchant } = await requireMerchant();
  const supabase = await createClient();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  let query = supabase
    .from("refunds")
    .select(
      "id, payment_id, mode, status, amount, currency, reason, merchant_refund_id, provider_refund_id, created_at, processed_at"
    )
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = toCsv(data ?? [], [
    { key: "id", label: "refund_id" },
    { key: "payment_id", label: "payment_id" },
    { key: "mode", label: "mode" },
    { key: "status", label: "status" },
    { key: "amount", label: "amount" },
    { key: "currency", label: "currency" },
    { key: "reason", label: "reason" },
    { key: "merchant_refund_id", label: "merchant_refund_id" },
    { key: "provider_refund_id", label: "provider_refund_id" },
    { key: "created_at", label: "created_at" },
    { key: "processed_at", label: "processed_at" }
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `refunds-${stamp}.csv`);
}
