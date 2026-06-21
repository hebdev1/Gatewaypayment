# HaitiPay roadmap

Path from the current MVP to a complete payment gateway covering every
type of Haitian merchant (e-commerce, retail, services, SaaS, NGOs,
marketplaces).

Calendar starts **2026-06-17**. Phase durations are estimates; each
sprint is 2 weeks.

---

## Snapshot today (2026-06-20)

| Solid | Basic | Missing |
|---|---|---|
| Auth + 2FA TOTP, KYC + Storage uploads, API + rate limiting, webhooks signed + scheduler, refunds, admin panel + audit log, settings + team, payment links + QR + invoices, multi-currency (HTG/USD/EUR/CAD/DOP), email outbox + Resend, Node SDK + OpenAPI + Postman, status page, i18n FR/HT/EN infra + 3 pages, **Settlement (Model A) payouts** | MonCash provider only, EN-only dashboard, hosted checkout simple, only customer-facing pages translated | NatCash adapter, cards/3DS, Apple/Google Pay, marketplace/Connect, subscriptions, WooCommerce plugin, automated fraud rules, 6 remaining public pages to translate, Sentry/observability |

## ⚠️ Architectural pivot — Settlement (Model A)

On 2026-06-20 the project moved from per-merchant MonCash credentials
("merchant collects, HaitiPay invoices") to a **Settlement** model:

- Customer pays via HaitiPay master MonCash account (env vars
  `HAITIPAY_MONCASH_*`)
- HaitiPay automatically retains 2.5% gateway fee in its master wallet
- HaitiPay pays merchants their net via `/v1/Transfert` on a per-merchant
  schedule (daily / weekly / monthly)
- Admin can manually mark stuck payouts as paid (bank wire, cash pickup)

This replaces the abandoned Fee Collection (Model C) brainstorm and the
original per-merchant provider credential flow. The
`payment_provider_credentials` table is kept as a legacy fallback.

---

## Phase 1 — Production launch (4 weeks · 2026-06-17 → 2026-07-14)

Goal: open the platform to the first **10 friendly merchants**.

### Sprint 1.1 (06-17 → 06-30) — Hardening
- [ ] Custom SMTP in Supabase Auth (Resend / SendGrid) — 0.5 d
- [ ] Custom domain + TLS + redirect URLs — 0.5 d
- [ ] 2FA / MFA on dashboard (Supabase MFA factors) — 1 d
- [ ] Rate limiting on edge functions (per API key) — 1 d
- [ ] Email notification to merchant on every succeeded payment — 0.5 d
- [ ] Sentry / structured logging on edge functions and Next.js — 1 d
- [ ] Status page (simple `/status` reading `cron.job_run_details` + advisors) — 0.5 d

### Sprint 1.2 (07-01 → 07-14) — Self-service tools
- [ ] **Payment links** UI: dashboard form → generates `/pay/<token>` URL — 1.5 d
- [ ] **QR code generator** for payment links (PNG download) — 0.5 d
- [ ] **CSV export** for payments + refunds (filters preserved) — 0.5 d
- [ ] **KYC document upload** to Supabase Storage (private bucket) — 1 d
- [ ] **Receipts**: PDF generation + auto-email to customer when succeeded — 1 d
- [ ] **i18n** wiring (FR / Créole / EN) on UI + checkout — 1.5 d

**Phase 1 exit criteria:** a merchant can sign up, complete KYC with
uploaded documents, generate a payment link, share it on WhatsApp,
receive money via MonCash, get an emailed PDF receipt, and download
a CSV of all payments.

---

## Phase 2 — Scale to 100 merchants (4 weeks · 2026-07-15 → 2026-08-11)

Goal: cover the **second biggest mobile wallet** and ship a clean
developer experience.

### Sprint 2.1 (07-15 → 07-28) — NatCash + payouts
- [ ] NatCash adapter (create + verify + refund if supported) — 2 d
- [ ] NatCash credentials UI in `/dashboard/provider-settings` — 0.5 d
- [ ] **Payout request flow**: merchant requests payout, admin approves,
      audit-logged. Records bank/MonCash account. No automation yet. — 2 d
- [ ] **Merchant payout history** page — 0.5 d
- [ ] Automatic payout schedule (T+7 default) — 1 d

### Sprint 2.2 (07-29 → 08-11) — Developer experience
- [ ] **`@haitipay/node` SDK** on npm (TypeScript) — 1.5 d
- [ ] **OpenAPI 3.1 spec** generated from edge function signatures — 1 d
- [ ] **Postman collection** auto-exported from OpenAPI — 0.5 d
- [ ] **Webhook event log + replay** UI (merchant can re-fire any past
      delivery) — 1 d
- [ ] **Webhook simulator**: send a fake `payment.succeeded` to your URL
      to test signature verification — 0.5 d
- [ ] **API versioning** (`v1` prefix on all edge function routes) — 0.5 d
- [ ] **IP allowlist** per API key — 0.5 d
- [ ] CLI: `npx haitipay test webhook` — 0.5 d

**Phase 2 exit criteria:** NatCash works end-to-end; a developer can
`npm install @haitipay/node` and integrate in &lt; 10 lines; payouts can
go out manually via admin approval.

---

## Phase 3 — E-commerce & subscriptions (6 weeks · 2026-08-12 → 2026-09-22)

Goal: cover **SaaS subscriptions, NGOs, and WooCommerce stores**.

### Sprint 3.1 (08-12 → 08-25) — Subscriptions
- [ ] DB schema: `products`, `prices`, `subscriptions`, `invoices`,
      `subscription_items` — 1 d
- [ ] `create-subscription` edge function (recurring billing) — 1.5 d
- [ ] Cron job: charge subscriptions on next_billing_at — 1 d
- [ ] Subscription dashboard pages (list, detail, cancel, update) — 1.5 d
- [ ] Dunning: retry failed renewals 3 times before mark `past_due` — 1 d
- [ ] Customer portal (`/portal/<token>`) for subscription self-management — 1 d

### Sprint 3.2 (08-26 → 09-08) — Invoices & customers
- [ ] `customers` table + dashboard CRUD — 1 d
- [ ] `invoices` table + creation UI + email send — 1.5 d
- [ ] Branded invoice PDF (merchant logo, colors) — 1 d
- [ ] Tax management (NIF, ITBIS, % rates per line) — 1 d
- [ ] Coupons / promo codes — 1 d
- [ ] Receipts customization (merchant logo + footer) — 0.5 d

### Sprint 3.3 (09-09 → 09-22) — Plugins & integrations
- [ ] **WooCommerce plugin** — 3 d
- [ ] **Shopify hosted checkout integration** — 2 d
- [ ] **n8n / Zapier integration** (webhook templates) — 0.5 d
- [ ] **Slack notification integration** — 0.5 d
- [ ] Embedded checkout (iframe + JS SDK) for sites with carts — 1.5 d

**Phase 3 exit criteria:** a SaaS company can run monthly subscriptions;
a WooCommerce store can install the plugin and accept MonCash payments;
NGOs can run recurring donation campaigns with receipts.

---

## Phase 4 — Cards & marketplaces (8 weeks · 2026-09-23 → 2026-11-17)

Goal: accept **bank cards** and enable **marketplace platforms**.

### Sprint 4.1 (09-23 → 10-06) — Card acquiring
- [ ] Adapter for a Caribbean card acquirer (Sogebank Cards / Unibank
      Cards / Worldpay LAC) — 3 d
- [ ] Tokenization service (`POST /tokenize` returns a `tok_…`) — 1.5 d
- [ ] 3D Secure 2 flow + challenge UI — 2 d
- [ ] PCI scope reduction: card data never touches our servers — 1 d

### Sprint 4.2 (10-07 → 10-20) — Apple Pay / Google Pay
- [ ] Apple Pay merchant onboarding (Apple developer + domain verification) — 1.5 d
- [ ] Apple Pay JS button in checkout — 1 d
- [ ] Google Pay JS button in checkout — 1 d
- [ ] Tokenized recurring payments support — 1 d

### Sprint 4.3 (10-21 → 11-03) — Marketplace / Connect
- [ ] DB schema: `connected_accounts` (sub-merchants) — 1 d
- [ ] Embedded onboarding flow for sub-merchant KYC — 2 d
- [ ] Split payments at create-payment time
      (`destination` + `application_fee_amount`) — 1.5 d
- [ ] Sub-merchant dashboard (scoped to their data) — 1.5 d
- [ ] Cross-account refund handling — 0.5 d

### Sprint 4.4 (11-04 → 11-17) — Risk & fraud
- [ ] Velocity rules (max N tx / hour / IP / customer) — 1 d
- [ ] Device fingerprint capture — 0.5 d
- [ ] OFAC / sanctions screening on KYC submission — 1 d
- [ ] AML transaction monitoring rules + admin alerts — 1.5 d
- [ ] Disputes / chargeback workflow (representment) — 2 d

**Phase 4 exit criteria:** every merchant type can accept payments via
mobile money, cards, Apple/Google Pay; marketplaces can onboard and
collect application fees automatically; risk team has tools to act on
fraud.

---

## Phase 5 — Polish & scale (4 weeks · 2026-11-18 → 2026-12-15)

Goal: **lock in the platform quality** for public launch.

### Sprint 5.1 (11-18 → 12-01) — Observability & SLA
- [ ] Status page public (uptime per service) — 1.5 d
- [ ] Alerting: Slack/email on error rate &gt; threshold — 1 d
- [ ] Metrics dashboard (admin only): TPS, error rate, p95 latency — 1.5 d
- [ ] Automated DB backups + retention policy — 0.5 d
- [ ] Disaster recovery runbook — 0.5 d

### Sprint 5.2 (12-02 → 12-15) — Compliance & docs
- [ ] Privacy policy + ToS (Haitian + EU users) — 1 d
- [ ] Data retention policy (anonymize old data) — 1 d
- [ ] Re-verification of KYC every 12 months — 1 d
- [ ] Public docs revamp (Stripe-like) + recipes book — 1.5 d
- [ ] Public marketing landing page — 1.5 d
- [ ] Customer support widget (email + form) — 0.5 d

**Phase 5 exit criteria:** public-facing, monitored, documented,
compliant. Ready for the first marketing push.

---

## Optional / future (post-launch)

These don't block "complete for all merchant types" but make HaitiPay
competitive long term:

- **Crypto** (USDC on Solana / Stellar)
- **Cash collection** at retail points
- **BNPL** / installment plans
- **Multi-currency** auto-conversion (USD / EUR / DOP)
- **Cross-border remittances** (diaspora → HT)
- **Reseller program** for agencies
- **White-label** version of the dashboard

---

## Quarterly progress goals

| Date | Milestone |
|---|---|
| **2026-07-14** | First 10 real merchants on live mode |
| **2026-08-11** | NatCash + clean SDK + payouts |
| **2026-09-22** | Subscriptions + WooCommerce + invoicing |
| **2026-11-17** | Cards + Apple/Google Pay + marketplaces |
| **2026-12-15** | Public launch ready |

Total: **~6 months** of focused work to reach a complete platform.

---

## Effort breakdown (rough)

- Phase 1 (hardening + self-service): ~17 dev-days
- Phase 2 (NatCash + SDK + payouts): ~15 dev-days
- Phase 3 (subs + invoices + plugins): ~24 dev-days
- Phase 4 (cards + marketplace + fraud): ~32 dev-days
- Phase 5 (polish + scale): ~13 dev-days
- **Total: ~100 dev-days** (~5 person-months at 100% focus)

A single-developer pace (50% focus, no weekends, occasional firefights)
realistically lands the full plan in **6 months**. A 2-developer team
can compress to **3 months**.
