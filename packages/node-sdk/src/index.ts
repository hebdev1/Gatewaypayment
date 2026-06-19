/**
 * @haitipay/node — Official TypeScript SDK for HaitiPay
 *
 * @example
 * ```ts
 * import { HaitiPay } from "@haitipay/node";
 *
 * const haitipay = new HaitiPay({ apiKey: process.env.HAITIPAY_API_KEY! });
 *
 * const { payment, checkoutUrl } = await haitipay.payments.create({
 *   amount: 500,
 *   currency: "HTG",
 *   orderId: "ORDER-1001",
 *   customer: { email: "buyer@example.com" }
 * });
 *
 * console.log("Redirect customer to:", checkoutUrl);
 * ```
 */

export interface HaitiPayConfig {
  /** Bearer API key generated in /dashboard/api-keys */
  apiKey: string;
  /** Override the base URL (defaults to production functions URL) */
  baseUrl?: string;
  /** Custom fetch implementation (mostly for tests) */
  fetch?: typeof fetch;
  /** Per-request timeout in ms (default 30000) */
  timeoutMs?: number;
}

export type PaymentStatus =
  | "created"
  | "pending"
  | "succeeded"
  | "failed"
  | "canceled"
  | "expired";

export type PaymentMode = "sandbox" | "live";
export type ProviderName = "moncash";

export interface Payment {
  id: string;
  merchant_order_id: string;
  provider: ProviderName;
  mode: PaymentMode;
  status: PaymentStatus;
  amount_gross: string;
  currency: string;
  display_amount: string | null;
  display_currency: string | null;
  exchange_rate_used: string | null;
  gateway_fee_amount: string;
  provider_fee_amount: string;
  merchant_net_amount: string;
  refunded_amount: string;
  hosted_checkout_url: string | null;
  provider_checkout_url: string | null;
  provider_transaction_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

export interface RefundStatus {
  id: string;
  payment_id: string;
  status: "created" | "pending" | "succeeded" | "failed" | "canceled";
  amount: string;
  currency: string;
  reason: string | null;
  merchant_refund_id: string | null;
  provider_refund_id: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface CreatePaymentInput {
  amount: number;
  currency?: string;
  orderId: string;
  provider?: ProviderName;
  customer?: {
    email?: string;
    phone?: string;
  };
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateRefundInput {
  paymentId?: string;
  orderId?: string;
  amount?: number;
  reason?: string;
  merchantRefundId?: string;
  metadata?: Record<string, unknown>;
}

export class HaitiPayApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(`HaitiPay [${code}]: ${message}`);
    this.name = "HaitiPayApiError";
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_BASE_URL = "https://ohymckfsvkvvshexwuun.functions.supabase.co";

/**
 * Verify a webhook signature from the `X-HaitiPay-Signature` header.
 *
 * Uses constant-time comparison to avoid timing attacks. Rejects payloads
 * older than `toleranceSeconds` (default 5 min) to prevent replay attacks.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  toleranceSeconds = 300
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => kv.split("=").map((s) => s.trim()))
  ) as Record<string, string>;

  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;

  if (Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;

  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  return timingSafeEqual(expected, v1);
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class HaitiPay {
  public readonly config: Required<Pick<HaitiPayConfig, "apiKey" | "baseUrl" | "timeoutMs">>;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HaitiPayConfig) {
    if (!config.apiKey) throw new Error("HaitiPay: apiKey is required.");
    this.config = {
      apiKey: config.apiKey,
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
      timeoutMs: config.timeoutMs ?? 30000
    };
    this.fetchImpl = config.fetch ?? fetch;
  }

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      const text = await response.text();
      const payload = text ? safeJson(text) : null;

      if (!response.ok) {
        const code = payload?.error?.code ?? "request_failed";
        const message = payload?.error?.message ?? text ?? "Request failed.";
        throw new HaitiPayApiError(response.status, code, message);
      }

      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Payment-related endpoints */
  public readonly payments = {
    create: async (input: CreatePaymentInput) => {
      const body: Record<string, unknown> = {
        amount: input.amount,
        currency: input.currency,
        orderId: input.orderId,
        provider: input.provider,
        customer: input.customer,
        description: input.description,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata
      };
      const result = await this.request<{
        payment: Payment;
        checkout_url: string;
        provider_checkout_url: string;
        idempotent?: boolean;
      }>("/create-payment", body);
      return {
        payment: result.payment,
        checkoutUrl: result.checkout_url,
        providerCheckoutUrl: result.provider_checkout_url,
        idempotent: Boolean(result.idempotent)
      };
    },

    verify: async (lookup: { paymentId?: string; orderId?: string; transactionId?: string }) => {
      const result = await this.request<{ ok: boolean; payment: Payment }>("/verify-payment", {
        payment_id: lookup.paymentId,
        order_id: lookup.orderId,
        transaction_id: lookup.transactionId
      });
      return result.payment;
    }
  };

  /** Refund endpoints */
  public readonly refunds = {
    create: async (input: CreateRefundInput) => {
      const result = await this.request<{ refund: RefundStatus; idempotent?: boolean }>(
        "/create-refund",
        {
          payment_id: input.paymentId,
          order_id: input.orderId,
          amount: input.amount,
          reason: input.reason,
          merchant_refund_id: input.merchantRefundId,
          metadata: input.metadata
        }
      );
      return result.refund;
    }
  };

  /** Webhooks helper exposed on the client for convenience */
  public readonly webhooks = {
    verify: verifyWebhookSignature
  };
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default HaitiPay;
