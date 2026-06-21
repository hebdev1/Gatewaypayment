import type {
  PaymentProviderAdapter,
  ProviderCreatePaymentInput,
  ProviderCreatePaymentResult,
  ProviderPayoutInput,
  ProviderPayoutResult,
  ProviderVerifyPaymentInput,
  ProviderVerifyPaymentResult
} from "./types.ts";
import { ProviderCapabilityError, ProviderTemporaryError } from "./types.ts";

export type MonCashCredentials = {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  gatewayBaseUrl: string;
};

function joinUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
  return `${normalizedBaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function gatewayRedirectUrl(gatewayBaseUrl: string, paymentToken: string) {
  const redirectBaseUrl = gatewayBaseUrl.includes("/Payment/Redirect")
    ? gatewayBaseUrl
    : joinUrl(gatewayBaseUrl, "/Payment/Redirect");
  const separator = redirectBaseUrl.includes("?") ? "&" : "?";
  return `${redirectBaseUrl}${separator}token=${encodeURIComponent(paymentToken)}`;
}

function basicAuth(clientId: string, clientSecret: string) {
  return btoa(`${clientId}:${clientSecret}`);
}

function extractPaymentToken(payload: any) {
  return (
    payload?.payment_token?.token ??
    payload?.payment_token ??
    payload?.token ??
    payload?.paymentToken ??
    null
  );
}

function extractStatus(payload: any): ProviderVerifyPaymentResult["status"] {
  const rawStatus = String(
    payload?.payment?.status ??
      payload?.payment?.message ??
      payload?.transaction?.status ??
      payload?.transaction?.message ??
      payload?.transfer?.message ??
      payload?.transStatus ??
      payload?.status ??
      payload?.message ??
      ""
  ).toLowerCase();

  if (["success", "successful", "approved", "paid", "completed"].includes(rawStatus)) return "succeeded";
  if (["failed", "declined", "error"].includes(rawStatus)) return "failed";
  if (["cancelled", "canceled"].includes(rawStatus)) return "canceled";
  if (["expired"].includes(rawStatus)) return "expired";
  return "pending";
}

export class MonCashAdapter implements PaymentProviderAdapter {
  name = "moncash" as const;

  // 59-second token (per official MonCash doc) — cache between calls in
  // the same edge function instance (e.g., when processing a batch of payouts).
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly credentials: MonCashCredentials) {}

  private async accessToken() {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 5000) {
      return this.cachedToken.value;
    }

    const response = await fetch(joinUrl(this.credentials.apiBaseUrl, "/oauth/token"), {
      method: "POST",
      headers: {
        authorization: `Basic ${basicAuth(this.credentials.clientId, this.credentials.clientSecret)}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ scope: "read,write", grant_type: "client_credentials" })
    });

    if (!response.ok) throw new Error(`MonCash auth failed with HTTP ${response.status}.`);
    const payload = await response.json();
    const token = payload?.access_token;
    if (!token) throw new Error("MonCash auth response did not include access_token.");

    this.cachedToken = {
      value: token,
      expiresAt: Date.now() + (Number(payload?.expires_in) || 59) * 1000
    };
    return token as string;
  }

  async createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResult> {
    const token = await this.accessToken();
    const response = await fetch(joinUrl(this.credentials.apiBaseUrl, "/v1/CreatePayment"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ amount: input.amount, orderId: input.orderId })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`MonCash create payment failed with HTTP ${response.status}.`);

    const paymentToken = extractPaymentToken(payload);
    if (!paymentToken) throw new Error("MonCash create payment response did not include payment_token.");

    return {
      providerPaymentToken: paymentToken,
      providerCheckoutUrl: gatewayRedirectUrl(this.credentials.gatewayBaseUrl, paymentToken),
      raw: payload
    };
  }

  async verifyPayment(input: ProviderVerifyPaymentInput): Promise<ProviderVerifyPaymentResult> {
    const token = await this.accessToken();
    const useTransaction = Boolean(input.transactionId);
    const path = useTransaction ? "/v1/RetrieveTransactionPayment" : "/v1/RetrieveOrderPayment";
    const body = useTransaction
      ? { transactionId: input.transactionId }
      : { orderId: input.orderId };

    const response = await fetch(joinUrl(this.credentials.apiBaseUrl, path), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`MonCash verify payment failed with HTTP ${response.status}.`);

    return {
      status: extractStatus(payload),
      providerTransactionId:
        payload?.payment?.transaction_id ??
        payload?.payment?.transactionId ??
        payload?.transaction?.id ??
        payload?.transactionId,
      raw: payload
    };
  }

  /**
   * Model A — Settlement. Push funds from HaitiPay master wallet to a
   * merchant's MonCash phone via POST /v1/Transfert.
   *
   * The MonCash REST API documents this endpoint as "PREFUNDED/PAYOUT".
   * It returns a `transfer.transaction_id` on success.
   */
  async payout(input: ProviderPayoutInput): Promise<ProviderPayoutResult> {
    const token = await this.accessToken();

    const response = await fetch(joinUrl(this.credentials.apiBaseUrl, "/v1/Transfert"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        amount: input.amount,
        receiver: input.destinationPhone,
        desc: input.description ?? `HaitiPay payout ${input.reference}`,
        reference: input.reference
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Errors documented in the official MonCash spec:
      // - 403 + "Maximum Account Balance": destination wallet is full (temporary)
      // - 403 otherwise: capability not enabled for this account (terminal)
      // - 404: receiver not found OR endpoint disabled
      if (response.status === 403) {
        const message = String(payload?.message ?? "");
        if (message.toLowerCase().includes("maximum account balance")) {
          throw new ProviderTemporaryError("destination_wallet_full", message);
        }
        throw new ProviderCapabilityError("moncash_transfert_forbidden", message || "Forbidden");
      }
      if (response.status === 404) {
        throw new ProviderCapabilityError(
          "moncash_transfert_receiver_not_found",
          String(payload?.message ?? "Receiver not found.")
        );
      }
      if (response.status >= 500) {
        throw new ProviderTemporaryError(
          "moncash_transfert_server_error",
          `MonCash Transfert HTTP ${response.status}`
        );
      }
      throw new Error(
        `MonCash Transfert failed with HTTP ${response.status}: ${JSON.stringify(payload)}`
      );
    }

    const transferStatus = String(payload?.transfer?.message ?? payload?.message ?? "").toLowerCase();
    const ok = ["success", "successful", "ok"].includes(transferStatus);

    return {
      status: ok ? "succeeded" : "pending",
      providerTransactionId: payload?.transfer?.transaction_id,
      raw: payload
    };
  }

  /**
   * Returns the prefunded balance of the HaitiPay master account, in HTG.
   * Used by the cron to skip Transfert attempts when the wallet is empty.
   */
  async getPrefundedBalance(): Promise<number> {
    const token = await this.accessToken();
    const response = await fetch(joinUrl(this.credentials.apiBaseUrl, "/v1/PrefundedBalance"), {
      method: "GET",
      headers: { authorization: `Bearer ${token}`, accept: "application/json" }
    });
    if (!response.ok) {
      throw new ProviderTemporaryError(
        "moncash_balance_unavailable",
        `PrefundedBalance HTTP ${response.status}`
      );
    }
    const payload = await response.json().catch(() => ({}));
    return Number(payload?.balance?.balance ?? 0);
  }
}
