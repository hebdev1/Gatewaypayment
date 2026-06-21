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

export type ProviderRefundPaymentInput = {
  providerTransactionId: string;
  amount: number;
  currency: string;
  reason?: string;
  refundId: string;
};

export type ProviderRefundPaymentResult = {
  status: "pending" | "succeeded" | "failed";
  providerRefundId?: string;
  raw: unknown;
};

// Model A — Settlement: HaitiPay holds the funds and sends them to the
// merchant via /v1/Transfert using HaitiPay's own master credentials.
export type ProviderPayoutInput = {
  destinationPhone: string;     // ex "50922334455"
  amount: number;
  reference: string;            // unique idempotency key (payouts.id slice)
  description?: string;
};

export type ProviderPayoutResult = {
  status: "succeeded" | "pending" | "failed";
  providerTransactionId?: string;
  raw: unknown;
};

export class ProviderCapabilityError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ProviderCapabilityError";
  }
}

export class ProviderTemporaryError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ProviderTemporaryError";
  }
}

export interface PaymentProviderAdapter {
  name: ProviderName;
  createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResult>;
  verifyPayment(input: ProviderVerifyPaymentInput): Promise<ProviderVerifyPaymentResult>;
  refundPayment?(input: ProviderRefundPaymentInput): Promise<ProviderRefundPaymentResult>;
  // Model A — Settlement: disburse funds from HaitiPay master wallet to a
  // merchant's MonCash phone via /v1/Transfert.
  payout?(input: ProviderPayoutInput): Promise<ProviderPayoutResult>;
  // Pre-flight check used by the cron to avoid attempting a Transfert when
  // HaitiPay's master wallet is short on funds.
  getPrefundedBalance?(): Promise<number>;
}
