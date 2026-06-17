# HaitiPay Gateway

Payment gateway for Haitian merchants. **MonCash** is the first provider; the
backend uses an adapter pattern so NatCash, banks, and card processors can be
added without rewriting payment orchestration.

## Stack

- **Next.js 15** (App Router, Server Actions) — merchant dashboard + hosted checkout
- **Supabase Auth** — merchant login, password reset, email verification
- **Supabase Postgres + RLS** — multi-tenant isolation
- **Supabase Edge Functions (Deno)** — merchant REST API
- **pg_cron + pg_net** — outbound webhook dispatcher
- **AES-256-GCM** — encryption at rest for provider credentials and webhook secrets

## Modules

| Area | Route / Function |
|---|---|
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback` |
| Onboarding | `/onboarding` |
| Dashboard | `/dashboard` (overview), `/dashboard/payments`, `/dashboard/payments/[id]`, `/dashboard/refunds` |
| Account | `/dashboard/api-keys`, `/dashboard/provider-settings`, `/dashboard/webhooks`, `/dashboard/kyc` |
| Hosted checkout | `/checkout/[paymentId]`, `/checkout/[paymentId]/return` |
| Public docs | `/docs` |
| Edge API | `create-payment`, `verify-payment`, `create-refund`, `provider-webhook`, `dispatch-webhooks` |

## Environment

Copy `.env.example` to `.env.local` for Next.js. Set the same server-side
secrets in **Supabase → Settings → Edge Functions → Secrets**.

Generate a 32-byte encryption key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

| Variable | Purpose | Where |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Next.js |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon key for SSR client | Next.js |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Admin operations | Next.js + Edge |
| `SUPABASE_FUNCTIONS_URL` | Functions base URL | Next.js |
| `FUNCTIONS_URL` | Same value, edge-side | Edge |
| `PUBLIC_SITE_URL` | Public URL (used in checkout, OG tags, redirects) | Next.js |
| `INTERNAL_FUNCTION_SECRET` | Inter-edge-function auth | Edge |
| `DISPATCHER_SECRET` | pg_cron → dispatch-webhooks auth | Edge |
| `CREDENTIAL_ENCRYPTION_KEY` | AES-GCM key (32 bytes base64) | Next.js + Edge |
| `CORS_ALLOWED_ORIGINS` | Optional, comma-separated origin allow-list for edge functions | Edge |

## Bootstrap the cron dispatcher

The webhook dispatcher runs as a `pg_cron` job that calls `/dispatch-webhooks`
every minute. It reads its secret from the Supabase Vault. After migrating, run
this once in the SQL Editor:

```sql
do $$
declare v_secret text := encode(gen_random_bytes(32), 'base64');
begin
  perform vault.create_secret(
    v_secret,
    'webhook_dispatcher_secret',
    'pg_cron → dispatch-webhooks shared secret'
  );
  perform vault.create_secret(
    'https://YOUR_REF.functions.supabase.co',
    'functions_base_url',
    'Functions URL for pg_cron HTTP calls'
  );
  raise notice 'DISPATCHER_SECRET = %', v_secret;
end $$;
```

Copy the generated `DISPATCHER_SECRET` and add it to the Edge Function Secrets
in the dashboard.

## API quick reference

Full docs are served at **`/docs`** in the running app. Quick example:

```bash
curl -X POST "$SUPABASE_FUNCTIONS_URL/create-payment" \
  -H "Authorization: Bearer sk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "currency": "HTG",
    "orderId": "ORDER-1001",
    "provider": "moncash"
  }'
```

Refund:

```bash
curl -X POST "$SUPABASE_FUNCTIONS_URL/create-refund" \
  -H "Authorization: Bearer sk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "payment_id": "<uuid>", "amount": 100 }'
```

### MonCash URLs

Use these values in `/dashboard/provider-settings`:

```text
Sandbox REST API: https://sandbox.moncashbutton.digicelgroup.com/Api
Sandbox Gateway:  https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware
Live REST API:    https://moncashbutton.digicelgroup.com/Api
Live Gateway:     https://moncashbutton.digicelgroup.com/Moncash-middleware
```

### Outbound webhook signature

Each delivery includes:

```text
X-HaitiPay-Event: payment.succeeded
X-HaitiPay-Signature: t=<unix_timestamp>,v1=<hex_hmac_sha256>
```

The signed payload is `<timestamp>.<raw_json_body>`. Verify with the `whsec_…`
secret shown when the endpoint was created. See `/docs` for a Node.js example.

### Inbound provider webhook

Rotate a per-account token in `/dashboard/provider-settings`. The dashboard
shows a one-time URL of the shape:

```
https://<project>.functions.supabase.co/provider-webhook?account_id=<id>&token=<token>
```

Paste it into your MonCash callback configuration. Requests without a valid
token are rejected with 401.

## Local development

```powershell
npm install
npm run typecheck
npm run dev
```

The Supabase migration directory contains every schema change. To apply them
to a fresh project:

```powershell
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase functions deploy create-payment
npx supabase functions deploy verify-payment
npx supabase functions deploy create-refund
npx supabase functions deploy provider-webhook
npx supabase functions deploy dispatch-webhooks
```

## Production deployment

### Option A — Vercel (managed)

1. Connect this repo to a Vercel project.
2. Set the env vars from the table above in **Project Settings → Environment Variables**.
3. Set `PUBLIC_SITE_URL` to the canonical production URL.
4. Configure **Supabase → Authentication → URL Configuration**:
   - Site URL: `https://<your-domain>`
   - Redirect URLs: add `https://<your-domain>/auth/callback`
5. Every push to `main` deploys automatically.

### Option B — Hostinger VPS / Cloud Hosting (self-hosted Node.js)

This project uses **Next.js Server Actions** so it cannot run on PHP shared
hosting. You need a Hostinger plan that supports Node.js (VPS or Cloud Hosting).

1. **Provision a VPS** with Ubuntu 22.04+ and a domain pointed at it.

2. **Install Node.js 20 LTS**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone and build**:
   ```bash
   git clone https://github.com/hebdev1/Gatewaypayment.git
   cd Gatewaypayment
   cp .env.example .env.local   # fill in all values
   npm ci
   npm run build
   ```

4. **Run with PM2** so it restarts on crash/boot:
   ```bash
   sudo npm i -g pm2
   pm2 start npm --name haitipay -- start
   pm2 startup     # follow printed instructions
   pm2 save
   ```

5. **Reverse proxy with Nginx + TLS** (terminate HTTPS at Nginx, proxy to Node
   on port 3000):

   `/etc/nginx/sites-available/haitipay`:
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;
     return 301 https://$host$request_uri;
   }

   server {
     listen 443 ssl http2;
     server_name your-domain.com;

     ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

     client_max_body_size 5m;

     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/haitipay /etc/nginx/sites-enabled/
   sudo certbot --nginx -d your-domain.com
   sudo nginx -t && sudo systemctl reload nginx
   ```

6. **Update Supabase Auth URL configuration** (Site URL + redirect URLs) with
   your new domain.

7. **Update `PUBLIC_SITE_URL`** in `.env.local` and restart PM2:
   ```bash
   pm2 restart haitipay
   ```

### Post-deploy checklist

- [ ] Supabase Edge Function secrets configured (especially `DISPATCHER_SECRET`)
- [ ] Supabase Auth redirect URLs include `https://<domain>/auth/callback`
- [ ] Leaked-password protection enabled in Supabase Auth
- [ ] At least one merchant created via `/register`, KYC submitted and approved
- [ ] MonCash sandbox credentials saved at `/dashboard/provider-settings`
- [ ] At least one outbound webhook endpoint created and tested via `/dashboard/webhooks`
- [ ] An inbound provider-webhook token generated and configured in MonCash
- [ ] `pg_cron` job `dispatch-webhooks-tick` is `active = true` in `cron.job`

## Security posture

- API keys are SHA-256 hashed before storage; the plaintext is shown once.
- Provider credentials and webhook secrets are AES-256-GCM encrypted at rest.
- All public tables enforce RLS via the `is_merchant_member()` helper.
- Trigger and admin helper functions are revoked from `anon`/`authenticated`.
- `set_updated_at` and other SECURITY DEFINER functions pin `search_path`.
- `getCurrentMerchant` filters explicitly by ownership/membership in addition
  to RLS.
- The inbound `provider-webhook` validates a per-account token and rejects
  duplicate provider callbacks within a 5-minute window.
- The Next.js layer ships baseline security headers (HSTS, XFO, XCTO,
  Referrer-Policy, Permissions-Policy).

## Roadmap

- NatCash adapter
- Real-money payouts to bank accounts
- Rate limiting on edge functions (Redis or DB-backed)
- 2FA / MFA
- i18n (French / Haitian Creole)
- E2E tests + CI
