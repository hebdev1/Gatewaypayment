import { ArrowRight, CreditCard, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { payLinkAction } from "./actions";

type LinkRow = {
  id: string;
  merchant_id: string;
  slug: string;
  mode: "sandbox" | "live";
  name: string;
  description: string | null;
  amount: string | null;
  currency: string;
  allow_custom_amount: boolean;
  min_amount: string | null;
  max_amount: string | null;
  collect_customer_email: boolean;
  collect_customer_phone: boolean;
  collect_customer_name: boolean;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  status: "active" | "archived";
  success_url: string | null;
  merchants: { display_name: string } | { display_name: string }[] | null;
};

function merchantName(link: LinkRow) {
  if (Array.isArray(link.merchants)) {
    return link.merchants[0]?.display_name ?? "Merchant";
  }
  return link.merchants?.display_name ?? "Merchant";
}

function unavailable(message: string) {
  return (
    <main className="checkout-shell">
      <section className="checkout-panel">
        <h1>Payment unavailable</h1>
        <p className="error">{message}</p>
      </section>
    </main>
  );
}

export default async function PayLinkPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const admin = createAdminClient();
  const { data: linkData } = await admin
    .from("payment_links")
    .select("*, merchants(display_name)")
    .eq("slug", slug)
    .maybeSingle();

  if (!linkData) return unavailable("This payment link does not exist.");
  const link = linkData as unknown as LinkRow;

  if (link.status !== "active") return unavailable("This payment link has been archived.");
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return unavailable("This payment link has expired.");
  }
  if (link.max_uses && link.use_count >= link.max_uses) {
    return unavailable("This payment link is no longer available.");
  }

  const isCustom = link.allow_custom_amount;
  const fixedDisplay = !isCustom && link.amount;

  return (
    <main className="checkout-shell">
      <section className="checkout-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Pay {merchantName(link)}</p>
            <h1>{link.name}</h1>
            {link.description ? (
              <p style={{ color: "var(--text-secondary)" }}>{link.description}</p>
            ) : null}
          </div>
          <div className="brand-mark">
            <CreditCard size={18} aria-hidden="true" />
          </div>
        </div>

        {fixedDisplay ? (
          <div className="checkout-amount">
            <span>Amount</span>
            <strong>
              {Number(link.amount).toLocaleString(undefined, {
                maximumFractionDigits: 2
              })}{" "}
              {link.currency}
            </strong>
          </div>
        ) : null}

        <form action={payLinkAction} className="stack">
          <input type="hidden" name="slug" value={link.slug} />

          {isCustom ? (
            <div className="field">
              <label htmlFor="amount">Amount ({link.currency})</label>
              <input
                className="input"
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min={link.min_amount ?? "0.01"}
                max={link.max_amount ?? undefined}
                required
                autoFocus
              />
              {(link.min_amount || link.max_amount) && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  {link.min_amount ? `Min: ${link.min_amount}` : ""}
                  {link.min_amount && link.max_amount ? " · " : ""}
                  {link.max_amount ? `Max: ${link.max_amount}` : ""}
                </p>
              )}
            </div>
          ) : null}

          {link.collect_customer_name ? (
            <div className="field">
              <label htmlFor="customer_name">Your name</label>
              <input
                className="input"
                id="customer_name"
                name="customer_name"
                autoComplete="name"
                required
              />
            </div>
          ) : null}

          {link.collect_customer_email ? (
            <div className="field">
              <label htmlFor="customer_email">Email</label>
              <input
                className="input"
                id="customer_email"
                name="customer_email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
          ) : null}

          {link.collect_customer_phone ? (
            <div className="field">
              <label htmlFor="customer_phone">Phone</label>
              <input
                className="input"
                id="customer_phone"
                name="customer_phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+509 XXXX XXXX"
                required
              />
            </div>
          ) : null}

          {search.error ? <p className="error">{decodeURIComponent(search.error)}</p> : null}

          <button className="button full" type="submit">
            Continue to payment <ArrowRight size={14} aria-hidden="true" />
          </button>
        </form>

        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            justifyContent: "center",
            color: "var(--text-tertiary)",
            fontSize: 12,
            marginTop: 18
          }}
        >
          <ShieldCheck size={12} aria-hidden="true" /> Secured by HaitiPay · {link.mode}
        </p>
      </section>
    </main>
  );
}
