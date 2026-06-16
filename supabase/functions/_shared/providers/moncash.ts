import type {
  PaymentProviderAdapter,
  ProviderCreatePaymentInput,
  ProviderCreatePaymentResult,
  ProviderVerifyPaymentInput,
  ProviderVerifyPaymentResult
} from "./types.ts";

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

  if (["success", "successful", "approved", "paid", "completed"].includes(rawStatus)) {
    return "succeeded";
  }

  if (["failed", "declined", "error"].includes(rawStatus)) {
    return "failed";
  }

  if (["cancelled", "canceled"].includes(rawStatus)) {
    return "canceled";
  }

  if (["expired"].includes(rawStatus)) {
    return "expired";
  }

  return "pending";
}

export class MonCashAdapter implements PaymentProviderAdapter {
  name = "moncash" as const;

  constructor(private readonly credentials: MonCashCredentials) {}

  private async accessToken() {
    const response = await fetch(joinUrl(this.credentials.apiBaseUrl, "/oauth/token"), {
      method: "POST",
      headers: {
        authorization: `Basic ${basicAuth(
          this.credentials.clientId,
          this.credentials.clientSecret
        )}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        scope: "read,write",
        grant_type: "client_credentials"
      })
    });

    if (!response.ok) {
      throw new Error(`MonCash auth failed with HTTP ${response.status}.`);
    }

    const payload = await response.json();
    const token = payload?.access_token;

    if (!token) {
      throw new Error("MonCash auth response did not include access_token.");
    }

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
      body: JSON.stringify({
        amount: input.amount,
        orderId: input.orderId
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`MonCash create payment failed with HTTP ${response.status}.`);
    }

    const paymentToken = extractPaymentToken(payload);

    if (!paymentToken) {
      throw new Error("MonCash create payment response did not include payment_token.");
    }

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
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`MonCash verify payment failed with HTTP ${response.status}.`);
    }

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
}
