export const GATEWAY_FEE_BPS = 250;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePaymentAmounts(
  gross: number,
  providerFeeBps = 0,
  providerFeeFixed = 0
) {
  const gatewayFee = roundMoney((gross * GATEWAY_FEE_BPS) / 10000);
  const providerFee = roundMoney((gross * providerFeeBps) / 10000 + providerFeeFixed);
  const merchantNet = roundMoney(gross - gatewayFee - providerFee);

  return {
    gatewayFee,
    providerFee,
    merchantNet
  };
}

export function formatMoney(amount: number | string, currency = "HTG") {
  const numeric = typeof amount === "number" ? amount : Number(amount);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code"
  }).format(Number.isFinite(numeric) ? numeric : 0);
}
