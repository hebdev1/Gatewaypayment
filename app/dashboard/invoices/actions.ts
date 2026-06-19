"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { publicSiteUrl } from "@/lib/env";
import { requireMerchant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/payment-utils";

function err(message: string): never {
  redirect(`/dashboard/invoices/new?error=${encodeURIComponent(message)}`);
}

async function nextInvoiceNumber(
  admin: ReturnType<typeof createAdminClient>,
  merchantId: string,
  mode: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = mode === "live" ? "INV" : "TST";
  const pattern = `${prefix}-${year}-%`;

  const { data } = await admin
    .from("invoices")
    .select("number")
    .eq("merchant_id", merchantId)
    .ilike("number", pattern)
    .order("number", { ascending: false })
    .limit(1);

  const lastSeq = data?.[0]?.number?.split("-").pop();
  const nextSeq = lastSeq ? Number(lastSeq) + 1 : 1;
  return `${prefix}-${year}-${String(nextSeq).padStart(4, "0")}`;
}

export async function createInvoiceAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const action = String(formData.get("action") ?? "save_draft");
  const customerEmail = String(formData.get("customer_email") ?? "").trim();
  const customerName = String(formData.get("customer_name") ?? "").trim() || null;
  const mode = String(formData.get("mode") ?? "sandbox") === "live" ? "live" : "sandbox";
  const currency = String(formData.get("currency") ?? "HTG").toUpperCase();
  const description = String(formData.get("description") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const taxAmount = Number(formData.get("tax_amount") ?? 0) || 0;
  const dueRaw = String(formData.get("due_at") ?? "").trim();

  if (!customerEmail) err("Customer email is required.");
  if (mode === "live" && !merchant.live_enabled) err("Live mode is not enabled.");

  // Parse up to 3 line items
  const items: Array<{ description: string; quantity: number; unit_price: number; amount: number }> = [];
  for (let i = 0; i < 3; i++) {
    const desc = String(formData.get(`item_desc_${i}`) ?? "").trim();
    const qty = Number(formData.get(`item_qty_${i}`) ?? 0);
    const price = Number(formData.get(`item_price_${i}`) ?? 0);
    if (!desc) continue;
    if (!Number.isFinite(qty) || qty <= 0) err(`Quantity required for "${desc}".`);
    if (!Number.isFinite(price) || price < 0) err(`Price required for "${desc}".`);
    items.push({ description: desc, quantity: qty, unit_price: price, amount: Math.round(qty * price * 100) / 100 });
  }

  if (!items.length) err("At least one line item is required.");

  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const admin = createAdminClient();
  const number = await nextInvoiceNumber(admin, merchant.id, mode);
  const slug = generateSlug(14);

  const { data: invoiceRow, error: insertError } = await admin
    .from("invoices")
    .insert({
      merchant_id: merchant.id,
      mode,
      slug,
      number,
      customer_email: customerEmail,
      customer_name: customerName,
      description,
      notes,
      subtotal_amount: subtotal,
      tax_amount: taxAmount,
      total_amount: total,
      currency,
      due_at: dueRaw ? new Date(dueRaw).toISOString() : null,
      status: action === "send" ? "open" : "draft",
      sent_at: action === "send" ? new Date().toISOString() : null
    })
    .select("id")
    .single();

  if (insertError) err(insertError.message);

  const invoiceId = invoiceRow!.id;

  const { error: itemsError } = await admin.from("invoice_items").insert(
    items.map((it, i) => ({
      invoice_id: invoiceId,
      position: i,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      amount: it.amount
    }))
  );

  if (itemsError) err(itemsError.message);

  if (action === "send") {
    await queueInvoiceEmail(admin, invoiceId, merchant.id);
  }

  revalidatePath("/dashboard/invoices");
  redirect(`/dashboard/invoices/${invoiceId}`);
}

async function queueInvoiceEmail(
  admin: ReturnType<typeof createAdminClient>,
  invoiceId: string,
  merchantId: string
) {
  const { data: invoiceRow } = await admin
    .from("invoices")
    .select("number, customer_email, customer_name, total_amount, currency, slug, due_at, description")
    .eq("id", invoiceId)
    .single();
  const { data: merchantRow } = await admin
    .from("merchants")
    .select("display_name")
    .eq("id", merchantId)
    .single();

  if (!invoiceRow || !merchantRow) return;

  const url = `${publicSiteUrl().replace(/\/$/, "")}/i/${invoiceRow.slug}`;
  const subject = `Invoice ${invoiceRow.number} from ${merchantRow.display_name}`;
  const dueLine = invoiceRow.due_at
    ? `<p style="color:#475467; font-size:13px; margin-top:6px;">Due ${new Date(invoiceRow.due_at).toLocaleDateString()}</p>`
    : "";

  const html = `
<div style="font-family: Inter, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #0b1220;">
  <h2 style="margin: 0 0 8px;">${merchantRow.display_name} sent you an invoice</h2>
  <p style="color: #475467; margin: 0 0 16px;">Invoice ${invoiceRow.number}${invoiceRow.description ? ` — ${invoiceRow.description}` : ""}.</p>
  <div style="background: #f5f6fa; border-radius: 12px; padding: 18px; margin-bottom: 18px;">
    <div style="color:#475467; font-size:13px;">Amount due</div>
    <div style="font-size:28px; font-weight:700; letter-spacing:-0.01em;">${Number(invoiceRow.total_amount).toLocaleString()} ${invoiceRow.currency}</div>
    ${dueLine}
  </div>
  <a href="${url}" style="display:inline-block; background:#4f46e5; color:#fff; padding:12px 18px; border-radius:10px; text-decoration:none; font-weight:700;">View and pay</a>
  <p style="margin-top:24px; color:#94a3b8; font-size:12px;">If the button doesn't work, copy this URL into your browser: ${url}</p>
</div>`.trim();

  await admin.from("email_outbox").insert({
    merchant_id: merchantId,
    to_address: invoiceRow.customer_email,
    subject,
    body_html: html,
    template_key: "invoice.sent",
    template_data: { invoice_id: invoiceId, slug: invoiceRow.slug }
  });
}

export async function sendInvoiceAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const invoiceId = String(formData.get("invoice_id") ?? "");
  if (!invoiceId) return;

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (!invoice) return;

  if (invoice.status === "draft") {
    await admin
      .from("invoices")
      .update({ status: "open", sent_at: new Date().toISOString() })
      .eq("id", invoice.id);
  }

  await queueInvoiceEmail(admin, invoice.id, merchant.id);
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
}

export async function voidInvoiceAction(formData: FormData) {
  const { merchant } = await requireMerchant();
  const invoiceId = String(formData.get("invoice_id") ?? "");
  if (!invoiceId) return;
  const admin = createAdminClient();
  await admin
    .from("invoices")
    .update({ status: "void", voided_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("merchant_id", merchant.id);
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
}
