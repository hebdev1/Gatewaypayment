# HaitiPay Gateway MVP

Supabase-based payment gateway MVP for Haiti with MonCash as the first provider.
The backend uses provider adapters so NatCash, card processors, and bank providers can be added without rewriting payment orchestration.

## Stack

- Next.js App Router for merchant dashboard and hosted checkout
- Supabase Auth for merchant login
- Supabase Postgres with RLS for tenant isolation
- Supabase Edge Functions for merchant API, provider verification, and webhook dispatch
- AES-GCM encrypted provider credentials and webhook secrets

## Modules

- Merchant registration and login: `/register`, `/login`, `/onboarding`
- API key management: `/dashboard/api-keys`
- MonCash credentials: `/dashboard/provider-settings`
- Webhook endpoints: `/dashboard/webhooks`
- Merchant dashboard: `/dashboard`
- Hosted checkout: `/checkout/[paymentId]`
- Edge API:
  - `create-payment`
  - `verify-payment`
  - `provider-webhook`
  - `dispatch-webhooks`

## Environment

Copy `.env.example` to `.env.local` for Next.js and set the same server-side secrets in Supabase Edge Function secrets.

Generate a 32-byte encryption key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Required Edge Function secrets:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY
FUNCTIONS_URL
PUBLIC_SITE_URL
INTERNAL_FUNCTION_SECRET
CREDENTIAL_ENCRYPTION_KEY
```

## Merchant Create Payment API

## MonCash URLs

Use these values in `/dashboard/provider-settings`:

```text
Sandbox REST API: https://sandbox.moncashbutton.digicelgroup.com/Api
Sandbox Gateway:  https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware
Live REST API:    https://moncashbutton.digicelgroup.com/Api
Live Gateway:     https://moncashbutton.digicelgroup.com/Moncash-middleware
```

The adapter appends `/Payment/Redirect?token=<payment-token>` after `CreatePayment`.

```bash
curl -X POST "$SUPABASE_FUNCTIONS_URL/create-payment" \
  -H "Authorization: Bearer sk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "currency": "HTG",
    "orderId": "ORDER-1001",
    "provider": "moncash",
    "customer": {
      "email": "customer@example.com",
      "phone": "+50900000000"
    },
    "description": "Invoice ORDER-1001",
    "success_url": "https://merchant.example/success",
    "cancel_url": "https://merchant.example/cancel",
    "metadata": {
      "invoice_id": "inv_1001"
    }
  }'
```

Successful responses include the hosted checkout URL and the provider checkout URL. The gateway fee is fixed at 2.5% and each successful payment stores gross amount, gateway fee, provider fee, and merchant net amount.

## Webhook Signatures

Merchant webhooks receive:

```text
X-HaitiPay-Event: payment.succeeded
X-HaitiPay-Signature: t=<unix_timestamp>,v1=<hex_hmac_sha256>
```

The signed payload is:

```text
<timestamp>.<raw_json_body>
```

Use the one-time `whsec_...` secret shown when creating an endpoint.

## Deploy

```powershell
npm.cmd install
npm.cmd run typecheck
npx.cmd supabase db push
npx.cmd supabase functions deploy create-payment
npx.cmd supabase functions deploy verify-payment
npx.cmd supabase functions deploy provider-webhook
npx.cmd supabase functions deploy dispatch-webhooks
npm.cmd run dev
```

The Supabase migration includes explicit grants and RLS policies because new Supabase projects no longer automatically expose new public tables to the Data API.
