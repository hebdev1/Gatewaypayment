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

function joinUrl(baseUrl: string, path: string) {
  const normalized = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
  return `${normalized.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function gatewayRedirectUrl(gatewayBaseUrl: string, token: string) {
  const base = gatewayBaseUrl.includes("/Payment/Redirect")
    ? gatewayBaseUrl
    : joinUrl(gatewayBaseUrl, "/Payment/Redirect");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}

async function decryptCredentials(
  admin: ReturnType<typeof createAdminClient>,
  accountId: string
): Promise<Credentials> {
  // We use the database's pgsodium/decryption capability indirectly: the
  // _shared crypto module lives in edge functions, so we call a tiny SQL
  // helper that returns the ciphertext, then decrypt in Node.
  const { data } = await admin
    .from("payment_provider_credentials")
    .select("credentials_ciphertext, nonce")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!data) throw new Error("Missing provider credentials.");

  const { ciphertext, nonce } = data as { ciphertext: string; nonce: string };
  const ciphertextValue = ciphertext ?? (data as Record<string, string>).credentials_ciphertext;
  const nonceValue = nonce ?? (data as Record<string, string>).nonce;

  const { subtle } = await import("crypto").then((m) => m.webcrypto);
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error("CREDENTIAL_ENCRYPTION_KEY is not configured.");
  let keyBytes = Buffer.from(raw, "base64");
  if (keyBytes.length !== 32) keyBytes = Buffer.from(raw, "utf8");
  if (keyBytes.length !== 32) throw new Error("CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes.");

  const key = await subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const decrypted = await subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(nonceValue, "base64") },
    key,
    Buffer.from(ciphertextValue, "base64")
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as Credentials;
}

async function moncashCreatePayment(
  credentials: Credentials,
  amount: number,
  orderId: string
): Promise<{ providerToken: string; providerCheckoutUrl: string; raw: unknown }> {
  const auth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64");

  const tokenResponse = await fetch(joinUrl(credentials.apiBaseUrl, "/oauth/token"), {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ scope: "read,write", grant_type: "client_credentials" })
  });

  if (!tokenResponse.ok) {
    throw new Error(`MonCash auth failed with HTTP ${tokenResponse.status}.`);
  }
  const tokenJson = await tokenResponse.json();
  const accessToken = tokenJson?.access_token;
  if (!accessToken) throw new Error("MonCash auth response missing access_token.");

  const createResponse = await fetch(joinUrl(credentials.apiBaseUrl, "/v1/CreatePayment"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ amount, orderId })
  });

  const payload = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok) {
    throw new Error(`MonCash CreatePayment failed with HTTP ${createResponse.status}.`);
  }
  const providerToken =
    payload?.payment_token?.token ??
    payload?.payment_token ??
    payload?.token ??
    payload?.paymentToken;
  if (!providerToken) throw new Error("MonCash response did not include payment_token.");

  return {
    providerToken,
    providerCheckoutUrl: gatewayRedirectUrl(credentials.gatewayBaseUrl, providerToken),
    raw: payload
  };
}

export default async function ProcessingPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment_id?: string }>;
}) {
  const { slug } = await params;
  const { payment_id } = await searchParams;

  if (!payment_id) {
    redirect(`/pay/${slug}?error=Missing%20payment.`);
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, merchant_id, mode, status, amount_gross, provider_checkout_url, provider_order_id")
    .eq("id", payment_id)
    .maybeSingle();

  if (!payment) {
    redirect(`/pay/${slug}?error=Payment%20not%20found.`);
  }

  // Already created — straight to provider
  if (payment!.provider_checkout_url) {
    redirect(payment!.provider_checkout_url);
  }

  // Find the merchant's MonCash account for this mode
  const { data: account } = await admin
    .from("payment_provider_accounts")
    .select("id")
    .eq("merchant_id", payment!.merchant_id)
    .eq("mode", payment!.mode)
    .eq("provider", "moncash")
    .eq("enabled", true)
    .maybeSingle();

  if (!account) {
    redirect(`/pay/${slug}?error=Provider%20not%20configured.`);
  }

  try {
    const credentials = await decryptCredentials(admin, account!.id);
    const result = await moncashCreatePayment(
      credentials,
      Number(payment!.amount_gross),
      payment!.provider_order_id ?? payment!.id
    );

    await admin
      .from("payments")
      .update({
        status: "pending",
        provider_payment_token: result.providerToken,
        provider_checkout_url: result.providerCheckoutUrl,
        provider_response: result.raw as Record<string, unknown>
      })
      .eq("id", payment!.id);

    await admin.from("payment_events").insert({
      merchant_id: payment!.merchant_id,
      payment_id: payment!.id,
      event_type: "payment.created",
      payload: { source: "payment_link", provider_response: result.raw }
    });

    redirect(result.providerCheckoutUrl);
  } catch (error) {
    await admin
      .from("payments")
      .update({
        status: "failed",
        provider_response: {
          error: error instanceof Error ? error.message : String(error)
        }
      })
      .eq("id", payment!.id);
    redirect(
      `/pay/${slug}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Payment failed to start."
      )}`
    );
  }

  return (
    <main className="checkout-shell">
      <section className="checkout-panel" style={{ textAlign: "center" }}>
        <Loader2 size={28} aria-hidden="true" />
        <h1 style={{ marginTop: 16 }}>Preparing your payment…</h1>
        <p>You&apos;ll be redirected to MonCash in a moment.</p>
      </section>
    </main>
  );
}
