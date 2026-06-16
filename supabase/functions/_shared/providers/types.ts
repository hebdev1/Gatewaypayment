export type ProviderName = "moncash";

export type ProviderCreatePaymentInput = {
  amount: number;
  currency: string;
  orderId: string;
};

export type ProviderCreatePaymentResult = {
  providerPaymentToken: string;
  providerCheckoutUrl: string;
  raw: unknown;
};

export type ProviderVerifyPaymentInput = {
  orderId?: string;
  transactionId?: string;
};

export type ProviderVerifyPaymentResult = {
  status: "pending" | "succeeded" | "failed" | "canceled" | "expired";
  providerTransactionId?: string;
  raw: unknown;
};

export interface PaymentProviderAdapter {
  name: ProviderName;
  createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResult>;
  verifyPayment(input: ProviderVerifyPaymentInput): Promise<ProviderVerifyPaymentResult>;
}
