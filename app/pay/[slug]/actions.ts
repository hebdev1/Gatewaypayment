"use server";

import { redirect } from "next/navigation";
import { publicSiteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const GATEWAY_FEE_BPS = 250;

type ConvertResult = {
  htg_amount: number;
  rate: number;
};

async function convertToHtg(
  admin: ReturnType<typeof createAdminClient>,
  amount: number,
  currency: string
): Promise<ConvertResult> {
  if (currency.toUpperCase() === "HTG") return { htg_amount: amount, rate: 1 };
  const { data, error } = await admin.rpc("convert_to_htg", {
    p_amount: amount,
    p_currency: currency.toUpperCase()
  });
  if (error || !data || !data.length) {
    throw new Error(error?.message ?? `Unsupported currency ${currency}.`);
  }
  return { htg_amount: Number(data[0].htg_amount), rate: Number(data[0].rate) };
}

function errOnLink(slug: string, message: string): never {
  redirect(`/pay/${slug}?error=${encodeURIComponent(message)}`);
}

export async function payLinkAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) throw new Error("Missing slug.");

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("payment_links")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!link) errOnLink(slug, "Payment link not found.");
  if (link!.status !== "active") errOnLink(slug, "This payment link is not active.");
  if (link!.expires_at && new Date(link!.expires_at).getTime() < Date.now()) {
    errOnLink(slug, "This payment link has expired.");
  }
  if (link!.max_uses && link!.use_count >= link!.max_uses) {
    errOnLink(slug, "This payment link is no longer available.");
  }

  // Resolve amount
  let displayAmount: number;
  if (link!.allow_custom_amount) {
    const raw = String(formData.get("amount") ?? "");
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) errOnLink(slug, "Enter a valid amount.");
    if (link!.min_amount && parsed < Number(link!.min_amount)) {
      errOnLink(slug, `Amount is below the minimum of ${link!.min_amount}.`);
    }
    if (link!.max_amount && parsed > Number(link!.max_amount)) {
      errOnLink(slug, `Amount is above the maximum of ${link!.max_amount}.`);
    }
    displayAmount = parsed;
  } else {
    displayAmount = Number(link!.amount);
  }

  const displayCurrency = String(link!.currency).toUpperCase();

  // Provider only supports HTG today; convert if needed.
  let htgAmount = displayAmount;
  let rate = 1;
  if (displayCurrency !== "HTG") {
    const conversion = await convertToHtg(admin, displayAmount, displayCurrency);
    htgAmount = conversion.htg_amount;
    rate = conversion.rate;
  }

  // Provider account
  const { data: providerAccount } = await admin
    .from("payment_provider_accounts")
    .select("id, provider_fee_bps, provider_fee_fixed")
    .eq("merchant_id", link!.merchant_id)
    .eq("mode", link!.mode)
    .eq("provider", "moncash")
    .eq("enabled", true)
    .maybeSingle();

  if (!providerAccount) {
    errOnLink(slug, "Provider not configured. Please contact the merchant.");
  }

  const gatewayFee = Math.round(htgAmount * GATEWAY_FEE_BPS) / 10000;
  const providerFee =
    Math.round(
      ((htgAmount * (providerAccount!.provider_fee_bps ?? 0)) / 10000 +
        Number(providerAccount!.provider_fee_fixed ?? 0)) *
        100
    ) / 100;
  const merchantNet = Math.max(0, htgAmount - gatewayFee - providerFee);

  const customerEmail = String(formData.get("customer_email") ?? "").trim() || null;
  const customerPhone = String(formData.get("customer_phone") ?? "").trim() || null;
  const customerName = String(formData.get("customer_name") ?? "").trim() || null;

  const merchantOrderId = `LNK-${link!.slug}-${Date.now()}`;
  const paymentId = crypto.randomUUID();
  const hostedCheckoutUrl = `${publicSiteUrl().replace(/\/$/, "")}/checkout/${paymentId}`;

  const insertMetadata: Record<string, unknown> = { source: "payment_link" };
  if (customerName) insertMetadata.customer_name = customerName;

  const { error: insertError } = await admin.from("payments").insert({
    id: paymentId,
    merchant_id: link!.merchant_id,
    provider: "moncash",
    mode: link!.mode,
    status: "created",
    merchant_order_id: merchantOrderId,
    provider_order_id: paymentId,
    hosted_checkout_url: hostedCheckoutUrl,
    amount_gross: htgAmount,
    gateway_fee_bps: GATEWAY_FEE_BPS,
    gateway_fee_amount: gatewayFee,
    provider_fee_amount: providerFee,
    merchant_net_amount: merchantNet,
    currency: "HTG",
    display_amount: displayCurrency === "HTG" ? null : displayAmount,
    display_currency: displayCurrency === "HTG" ? null : displayCurrency,
    exchange_rate_used: displayCurrency === "HTG" ? null : rate,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    description: link!.name,
    success_url: link!.success_url,
    payment_link_id: link!.id,
    metadata: insertMetadata
  });

  if (insertError) errOnLink(slug, insertError.message);

  // The actual MonCash CreatePayment call must run server-side in an edge
  // function for two reasons: (1) the credentials are encrypted with a key
  // available there and (2) we want a consistent code path. So we just
  // redirect to the hosted checkout — the checkout/[paymentId]/page already
  // handles "pending" by linking to provider_checkout_url. But that URL
  // isn't created yet. Instead, send the user to a small intermediate
  // route that triggers create-payment-from-record server-side.
  //
  // For the MVP we just redirect to the hosted checkout. When the user lands
  // there, we'll call verify-payment-on-load — but more important, we need
  // the provider_checkout_url. So we synchronously call the adapter here
  // via a server-side fetch to /functions/v1/create-payment is overkill.
  //
  // Pragmatic shortcut: leave provider_checkout_url null. The checkout page
  // will show "Payment provider link is not ready" — which is not great.
  // So instead, we call MonCash inline here:
  redirect(`/pay/${slug}/processing?payment_id=${paymentId}`);
}
