# @haitipay/node

Official TypeScript SDK for the [HaitiPay](https://gatewaypayment.vercel.app/docs) payment gateway.

## Install

```bash
npm install @haitipay/node
```

## Quick start

```ts
import { HaitiPay } from "@haitipay/node";

const haitipay = new HaitiPay({
  apiKey: process.env.HAITIPAY_API_KEY! // sk_test_… or sk_live_…
});

// Create a payment
const { payment, checkoutUrl } = await haitipay.payments.create({
  amount: 500,
  currency: "HTG",
  orderId: "ORDER-1001",
  customer: { email: "buyer@example.com" },
  description: "Friday meal",
  successUrl: "https://shop.example/thanks",
  cancelUrl: "https://shop.example/cart"
});

console.log("Redirect the customer to:", checkoutUrl);
```

## Verify a payment

```ts
const payment = await haitipay.payments.verify({ paymentId: "<uuid>" });
if (payment.status === "succeeded") {
  // Mark order as paid in your DB
}
```

## Refund (partial or full)

```ts
// Full refund of the remaining balance
await haitipay.refunds.create({ paymentId: "<uuid>" });

// Partial refund with an idempotency key
await haitipay.refunds.create({
  paymentId: "<uuid>",
  amount: 100,
  reason: "Customer requested",
  merchantRefundId: "rf_internal_42"
});
```

## Verify a webhook

HaitiPay signs every outbound webhook with HMAC-SHA-256. Use the helper to
verify the signature **and** the timestamp in a single call:

```ts
import { verifyWebhookSignature } from "@haitipay/node";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-haitipay-signature");

  const isValid = await verifyWebhookSignature(
    rawBody,
    signature,
    process.env.HAITIPAY_WEBHOOK_SECRET!
  );

  if (!isValid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);
  // event.type === "payment.succeeded" | "refund.succeeded" | ...
  // event.data.payment, event.data.refund, etc.
  return new Response("ok");
}
```

## Configuration

```ts
new HaitiPay({
  apiKey: "sk_…",                      // required
  baseUrl: "https://your-self-hosted-functions.com",  // optional
  timeoutMs: 15000,                    // optional, default 30000
  fetch: customFetch                   // optional, default global fetch
});
```

## Errors

Network and HTTP failures throw a `HaitiPayApiError` with `status` and `code`:

```ts
import { HaitiPay, HaitiPayApiError } from "@haitipay/node";

try {
  await haitipay.payments.create({ amount: 0, currency: "HTG", orderId: "X" });
} catch (error) {
  if (error instanceof HaitiPayApiError) {
    console.log(error.status, error.code, error.message);
  }
}
```

## License

MIT
