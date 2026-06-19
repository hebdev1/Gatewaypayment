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
  const mode = url.searchParams.get("mode");
  const fromIso = url.searchParams.get("from");
  const toIso = url.searchParams.get("to");

  let query = supabase
    .from("payments")
    .select(
      "id, merchant_order_id, mode, status, provider, currency, amount_gross, gateway_fee_amount, provider_fee_amount, merchant_net_amount, refunded_amount, display_amount, display_currency, exchange_rate_used, customer_email, customer_phone, description, created_at, paid_at"
    )
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (status) query = query.eq("status", status);
  if (mode) query = query.eq("mode", mode);
  if (fromIso) query = query.gte("created_at", fromIso);
  if (toIso) query = query.lte("created_at", toIso);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = toCsv(data ?? [], [
    { key: "id", label: "payment_id" },
    { key: "merchant_order_id", label: "order_id" },
    { key: "mode", label: "mode" },
    { key: "status", label: "status" },
    { key: "provider", label: "provider" },
    { key: "amount_gross", label: "amount_gross" },
    { key: "currency", label: "currency" },
    { key: "display_amount", label: "display_amount" },
    { key: "display_currency", label: "display_currency" },
    { key: "exchange_rate_used", label: "exchange_rate_used" },
    { key: "gateway_fee_amount", label: "gateway_fee" },
    { key: "provider_fee_amount", label: "provider_fee" },
    { key: "merchant_net_amount", label: "merchant_net" },
    { key: "refunded_amount", label: "refunded_amount" },
    { key: "customer_email", label: "customer_email" },
    { key: "customer_phone", label: "customer_phone" },
    { key: "description", label: "description" },
    { key: "created_at", label: "created_at" },
    { key: "paid_at", label: "paid_at" }
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `payments-${stamp}.csv`);
}
