import Link from "next/link";
import { Book, Code2, KeyRound, RadioTower, RotateCcw, Shield } from "lucide-react";

export const metadata = {
  title: "HaitiPay API documentation",
  description: "REST API reference for the HaitiPay Gateway"
};

const baseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL ??
  "https://YOUR_PROJECT.functions.supabase.co";

export default function DocsPage() {
  return (
    <main className="docs-shell">
      <aside className="docs-toc">
        <Link href="/" className="brand-row" style={{ marginBottom: 24 }}>
          <div>
            <p className="eyebrow">HaitiPay</p>
            <h2 style={{ marginBottom: 0 }}>API docs</h2>
          </div>
        </Link>
        <nav className="docs-nav">
          <a href="#getting-started">
            <Book size={14} aria-hidden="true" /> Getting started
          </a>
          <a href="#auth">
            <KeyRound size={14} aria-hidden="true" /> Authentication
          </a>
          <a href="#create-payment">
            <Code2 size={14} aria-hidden="true" /> Create payment
          </a>
          <a href="#verify-payment">
            <Code2 size={14} aria-hidden="true" /> Verify payment
          </a>
          <a href="#create-refund">
            <RotateCcw size={14} aria-hidden="true" /> Create refund
          </a>
          <a href="#webhooks">
            <RadioTower size={14} aria-hidden="true" /> Webhooks
          </a>
          <a href="#security">
            <Shield size={14} aria-hidden="true" /> Security
          </a>
          <a href="#errors">Errors</a>

          <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Resources</p>
            <a href="/openapi.yaml" download>📄 OpenAPI 3.1 spec</a>
            <br />
            <a href="/postman.json" download>📦 Postman collection</a>
            <br />
            <a href="https://www.npmjs.com/package/@haitipay/node" target="_blank" rel="noreferrer">📥 npm @haitipay/node</a>
          </div>
        </nav>
      </aside>

      <article className="docs-content">
        <header style={{ marginBottom: 28 }}>
          <p className="eyebrow">API reference</p>
          <h1>HaitiPay Gateway API</h1>
          <p>
            HaitiPay is a payment gateway for Haitian merchants. The current adapter is{" "}
            <strong>MonCash</strong>; the same API will route to NatCash, banks and card
            processors as those adapters ship.
          </p>
        </header>

        <section id="getting-started">
          <h2>Getting started</h2>
          <ol>
            <li>
              Sign up at <Link href="/register">/register</Link> and finish onboarding.
            </li>
            <li>
              Configure your MonCash credentials at{" "}
              <Link href="/dashboard/provider-settings">/dashboard/provider-settings</Link>.
            </li>
            <li>
              Create an API key at{" "}
              <Link href="/dashboard/api-keys">/dashboard/api-keys</Link>. Keys are shown
              once — copy them immediately.
            </li>
            <li>
              Register webhook endpoints at{" "}
              <Link href="/dashboard/webhooks">/dashboard/webhooks</Link> so you receive
              event callbacks.
            </li>
          </ol>
          <p>
            <strong>Base URL:</strong> <code className="mono">{baseUrl}</code>
          </p>
        </section>

        <section id="auth">
          <h2>Authentication</h2>
          <p>
            All merchant endpoints require a Bearer API key. Keys are prefixed{" "}
            <code className="mono">sk_test_</code> (sandbox) or{" "}
            <code className="mono">sk_live_</code> (live). The key&apos;s mode determines
            which environment the request hits.
          </p>
          <pre className="mono small">
{`Authorization: Bearer sk_test_xxxxxxxxxxxx
Content-Type: application/json`}
          </pre>
          <p>
            You can rotate keys at any time. Revoked keys return HTTP 401.
          </p>
        </section>

        <section id="create-payment">
          <h2>Create payment</h2>
          <p>
            <code className="mono">POST /create-payment</code> — creates a payment and
            returns the hosted checkout URL plus the provider&apos;s checkout URL. The
            request is idempotent on the tuple{" "}
            <code className="mono">(merchant_id, mode, orderId)</code>.
          </p>
          <h3>Request body</h3>
          <pre className="mono small">
{`{
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
  "metadata": { "invoice_id": "inv_1001" }
}`}
          </pre>
          <h3>Example</h3>
          <pre className="mono small">
{`curl -X POST "${baseUrl}/create-payment" \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 500, "currency": "HTG", "orderId": "ORDER-1001" }'`}
          </pre>
          <h3>Response</h3>
          <pre className="mono small">
{`{
  "payment": { "id": "uuid", "status": "pending", ... },
  "checkout_url": "https://gatewaypayment.vercel.app/checkout/<uuid>",
  "provider_checkout_url": "https://sandbox.moncashbutton..."
}`}
          </pre>
        </section>

        <section id="verify-payment">
          <h2>Verify payment</h2>
          <p>
            <code className="mono">POST /verify-payment</code> — pulls the latest status
            from the provider. Useful for poll-based reconciliation; webhooks remain the
            recommended path.
          </p>
          <pre className="mono small">
{`curl -X POST "${baseUrl}/verify-payment" \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "payment_id": "<uuid>" }'`}
          </pre>
          <p>
            You can also identify the payment by{" "}
            <code className="mono">order_id</code> (your{" "}
            <code className="mono">orderId</code>) or{" "}
            <code className="mono">transaction_id</code> (the provider&apos;s id).
          </p>
        </section>

        <section id="create-refund">
          <h2>Create refund</h2>
          <p>
            <code className="mono">POST /create-refund</code> — refunds a succeeded
            payment. Pass <code className="mono">amount</code> for a partial refund;
            omit it to refund the remaining balance. Use{" "}
            <code className="mono">merchant_refund_id</code> for idempotency.
          </p>
          <pre className="mono small">
{`curl -X POST "${baseUrl}/create-refund" \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "payment_id": "<uuid>",
    "amount": 100,
    "reason": "customer requested",
    "merchant_refund_id": "rf_internal_42"
  }'`}
          </pre>
          <p>
            MonCash does not currently expose a refund API, so the refund is recorded as
            <code className="mono"> pending</code> until the merchant settles it manually
            in the MonCash portal and marks it succeeded in the HaitiPay dashboard.
            Future provider adapters with native refund APIs will resolve refunds
            automatically.
          </p>
        </section>

        <section id="webhooks">
          <h2>Webhooks</h2>
          <p>
            Each endpoint you register at{" "}
            <Link href="/dashboard/webhooks">/dashboard/webhooks</Link> receives a POST
            with these headers:
          </p>
          <pre className="mono small">
{`X-HaitiPay-Event: payment.succeeded
X-HaitiPay-Signature: t=<unix_timestamp>,v1=<hex_hmac_sha256>
Content-Type: application/json`}
          </pre>
          <p>
            The signed payload is <code className="mono">{`<timestamp>.<raw_json_body>`}</code>.
            Verify it with the{" "}
            <code className="mono">whsec_</code> secret shown when the endpoint was
            created.
          </p>
          <h3>Event types</h3>
          <ul>
            <li>
              <code className="mono">payment.succeeded</code> — payment is paid
            </li>
            <li>
              <code className="mono">payment.failed</code> — declined or errored
            </li>
            <li>
              <code className="mono">payment.canceled</code> — cancelled by the buyer
            </li>
            <li>
              <code className="mono">payment.expired</code> — timed out
            </li>
            <li>
              <code className="mono">refund.pending</code> — refund created, awaiting
              settlement
            </li>
            <li>
              <code className="mono">refund.succeeded</code> — refund settled
            </li>
            <li>
              <code className="mono">refund.failed</code> — refund could not be settled
            </li>
          </ul>
          <h3>Signature verification (Node.js)</h3>
          <pre className="mono small">
{`import crypto from "crypto";

function isValid(rawBody, header, secret, toleranceSec = 300) {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=").map((s) => s.trim()))
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}`}
          </pre>
          <h3>Inbound provider webhooks</h3>
          <p>
            HaitiPay also accepts callbacks from your provider (MonCash) so we can
            confirm transaction status without polling. Generate a per-account inbound
            URL at{" "}
            <Link href="/dashboard/provider-settings">/dashboard/provider-settings</Link>{" "}
            and paste it into the MonCash dashboard.
          </p>
        </section>

        <section id="security">
          <h2>Security</h2>
          <ul>
            <li>API keys are hashed (SHA-256) before storage and never readable again.</li>
            <li>
              Provider credentials and webhook secrets are encrypted at rest with
              AES-256-GCM.
            </li>
            <li>Tenant isolation is enforced by Postgres Row Level Security.</li>
            <li>
              All edge endpoints require <code className="mono">Bearer</code> auth except{" "}
              <code className="mono">/provider-webhook</code>, which validates a per-account
              token in the URL.
            </li>
          </ul>
        </section>

        <section id="errors">
          <h2>Errors</h2>
          <p>Responses use a consistent envelope:</p>
          <pre className="mono small">
{`{ "error": { "code": "payment_not_found", "message": "Payment not found." } }`}
          </pre>
          <h3>Common codes</h3>
          <ul>
            <li>
              <code className="mono">bad_request</code> (400) — validation error
            </li>
            <li>
              <code className="mono">payment_not_refundable</code> (409) — payment not
              in succeeded state
            </li>
            <li>
              <code className="mono">amount_exceeds_remaining</code> (400) — refund too
              large
            </li>
            <li>
              <code className="mono">fully_refunded</code> (409) — already fully refunded
            </li>
            <li>
              <code className="mono">inbound_token_invalid</code> (401) — provider
              webhook token mismatch
            </li>
            <li>
              <code className="mono">provider_create_failed</code> (502) — provider API
              error
            </li>
            <li>
              <code className="mono">payment_not_found</code> (404)
            </li>
          </ul>
        </section>
      </article>
    </main>
  );
}
