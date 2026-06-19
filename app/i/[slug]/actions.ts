"use server";

import { redirect } from "next/navigation";
import { publicSiteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const GATEWAY_FEE_BPS = 250;

function errOnInvoice(slug: string, message: string): never {
  redirect(`/i/${slug}?error=${encodeURIComponent(message)}`);
}

async function convertToHtg(
  admin: ReturnType<typeof createAdminClient>,
  amount: number,
  currency: string
) {
  if (currency.toUpperCase() === "HTG") return { htg: amount, rate: 1 };
  const { data, error } = await admin.rpc("convert_to_htg", {
    p_amount: amount,
    p_currency: currency.toUpperCase()
  });
  if (error || !data?.length) throw new Error(error?.message ?? `Unsupported currency ${currency}.`);
  return { htg: Number(data[0].htg_amount), rate: Number(data[0].rate) };
}

export async function payInvoiceAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) throw new Error("Missing slug.");

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!invoice) errOnInvoice(slug, "Invoice not found.");
  if (invoice!.status === "void") errOnInvoice(slug, "Invoice has been voided.");
  if (invoice!.status === "paid") errOnInvoice(slug, "Invoice already paid.");

  const displayCurrency = String(invoice!.currency).toUpperCase();
  const displayAmount = Number(invoice!.total_amount);

  let htg = displayAmount;
  let rate = 1;
  if (displayCurrency !== "HTG") {
    const conv = await convertToHtg(admin, displayAmount, displayCurrency);
    htg = conv.htg;
    rate = conv.rate;
  }

  const { data: providerAccount } = await admin
    .from("payment_provider_accounts")
    .select("id, provider_fee_bps, provider_fee_fixed")
    .eq("merchant_id", invoice!.merchant_id)
    .eq("mode", invoice!.mode)
    .eq("provider", "moncash")
    .eq("enabled", true)
    .maybeSingle();

  if (!providerAccount) errOnInvoice(slug, "Provider not configured.");

  const gatewayFee = Math.round(htg * GATEWAY_FEE_BPS) / 10000;
  const providerFee =
    Math.round(
      ((htg * (providerAccount!.provider_fee_bps ?? 0)) / 10000 +
        Number(providerAccount!.provider_fee_fixed ?? 0)) *
        100
    ) / 100;
  const merchantNet = Math.max(0, htg - gatewayFee - providerFee);

  const paymentId = crypto.randomUUID();
  const merchantOrderId = `INV-${invoice!.number}-${Date.now()}`;
  const hostedCheckoutUrl = `${publicSiteUrl().replace(/\/$/, "")}/checkout/${paymentId}`;

  const { error: insertError } = await admin.from("payments").insert({
    id: paymentId,
    merchant_id: invoice!.merchant_id,
    provider: "moncash",
    mode: invoice!.mode,
    status: "created",
    merchant_order_id: merchantOrderId,
    provider_order_id: paymentId,
    hosted_checkout_url: hostedCheckoutUrl,
    amount_gross: htg,
    gateway_fee_bps: GATEWAY_FEE_BPS,
    gateway_fee_amount: gatewayFee,
    provider_fee_amount: providerFee,
    merchant_net_amount: merchantNet,
    currency: "HTG",
    display_amount: displayCurrency === "HTG" ? null : displayAmount,
    display_currency: displayCurrency === "HTG" ? null : displayCurrency,
    exchange_rate_used: displayCurrency === "HTG" ? null : rate,
    customer_email: invoice!.customer_email,
    customer_phone: invoice!.customer_phone,
    description: `Invoice ${invoice!.number}`,
    invoice_id: invoice!.id,
    metadata: { source: "invoice", invoice_number: invoice!.number }
  });

  if (insertError) errOnInvoice(slug, insertError.message);

  // Reuse the processing route from payment links — it just needs payment_id
  redirect(`/pay/_invoice/processing?payment_id=${paymentId}&slug=${slug}`);
}
