import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Credentials = {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  gatewayBaseUrl: string;
};

function joinUrl(b: string, p: string) {
  const n = /^https?:\/\//i.test(b) ? b : `https://${b}`;
  return `${n.replace(/\/$/, "")}/${p.replace(/^\//, "")}`;
}

function gatewayRedirectUrl(base: string, token: string) {
  const b = base.includes("/Payment/Redirect") ? base : joinUrl(base, "/Payment/Redirect");
  return `${b}${b.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

async function decryptCredentials(admin: ReturnType<typeof createAdminClient>, accountId: string): Promise<Credentials> {
  const { data } = await admin
    .from("payment_provider_credentials")
    .select("credentials_ciphertext, nonce")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!data) throw new Error("Missing provider credentials.");

  const { subtle } = await import("crypto").then((m) => m.webcrypto);
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error("CREDENTIAL_ENCRYPTION_KEY is not configured.");
  let keyBytes = Buffer.from(raw, "base64");
  if (keyBytes.length !== 32) keyBytes = Buffer.from(raw, "utf8");
  if (keyBytes.length !== 32) throw new Error("CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes.");
  const key = await subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const decrypted = await subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from((data as { nonce: string }).nonce, "base64") },
    key,
    Buffer.from((data as { credentials_ciphertext: string }).credentials_ciphertext, "base64")
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as Credentials;
}

async function moncashCreate(credentials: Credentials, amount: number, orderId: string) {
  const auth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64");
  const tokenResponse = await fetch(joinUrl(credentials.apiBaseUrl, "/oauth/token"), {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ scope: "read,write", grant_type: "client_credentials" })
  });
  if (!tokenResponse.ok) throw new Error(`MonCash auth HTTP ${tokenResponse.status}.`);
  const { access_token } = await tokenResponse.json();
  if (!access_token) throw new Error("Missing access_token.");
  const r = await fetch(joinUrl(credentials.apiBaseUrl, "/v1/CreatePayment"), {
    method: "POST",
    headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ amount, orderId })
  });
  const payload = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`MonCash CreatePayment HTTP ${r.status}.`);
  const tok =
    payload?.payment_token?.token ?? payload?.payment_token ?? payload?.token ?? payload?.paymentToken;
  if (!tok) throw new Error("Missing payment_token.");
  return { token: tok, url: gatewayRedirectUrl(credentials.gatewayBaseUrl, tok), raw: payload };
}

export default async function InvoiceProcessingPage({
  searchParams
}: {
  searchParams: Promise<{ payment_id?: string; slug?: string }>;
}) {
  const sp = await searchParams;
  const paymentId = sp.payment_id;
  const slug = sp.slug;
  if (!paymentId || !slug) redirect("/");

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, merchant_id, mode, status, amount_gross, provider_checkout_url, provider_order_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) redirect(`/i/${slug}?error=Payment%20not%20found.`);
  if (payment!.provider_checkout_url) redirect(payment!.provider_checkout_url);

  const { data: account } = await admin
    .from("payment_provider_accounts")
    .select("id")
    .eq("merchant_id", payment!.merchant_id)
    .eq("mode", payment!.mode)
    .eq("provider", "moncash")
    .eq("enabled", true)
    .maybeSingle();
  if (!account) redirect(`/i/${slug}?error=Provider%20not%20configured.`);

  try {
    const credentials = await decryptCredentials(admin, account!.id);
    const result = await moncashCreate(
      credentials,
      Number(payment!.amount_gross),
      payment!.provider_order_id ?? payment!.id
    );
    await admin
      .from("payments")
      .update({
        status: "pending",
        provider_payment_token: result.token,
        provider_checkout_url: result.url,
        provider_response: result.raw as Record<string, unknown>
      })
      .eq("id", payment!.id);
    await admin.from("payment_events").insert({
      merchant_id: payment!.merchant_id,
      payment_id: payment!.id,
      event_type: "payment.created",
      payload: { source: "invoice", provider_response: result.raw }
    });
    redirect(result.url);
  } catch (e) {
    await admin
      .from("payments")
      .update({
        status: "failed",
        provider_response: { error: e instanceof Error ? e.message : String(e) }
      })
      .eq("id", payment!.id);
    redirect(`/i/${slug}?error=${encodeURIComponent(e instanceof Error ? e.message : "Payment failed to start.")}`);
  }

  return (
    <main className="checkout-shell">
      <section className="checkout-panel" style={{ textAlign: "center" }}>
        <Loader2 size={28} aria-hidden="true" />
        <h1 style={{ marginTop: 16 }}>Preparing your payment…</h1>
      </section>
    </main>
  );
}
