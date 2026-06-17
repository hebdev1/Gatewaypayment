import { ShieldCheck } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveDraftAction, submitKycAction } from "./actions";

type Submission = {
  id: string;
  status: "not_started" | "draft" | "submitted" | "approved" | "rejected";
  business_data: Record<string, string>;
  document_urls: string[];
  submitted_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

export default async function KycPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; saved?: string; submitted?: string }>;
}) {
  const params = await searchParams;
  const { merchant } = await requireMerchant();
  const supabase = await createClient();
  const { data } = await supabase
    .from("kyc_submissions")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const submission = (data ?? null) as Submission | null;
  const business = (submission?.business_data ?? {}) as Record<string, string>;
  const docs = (submission?.document_urls ?? []) as string[];
  const locked = submission?.status === "submitted" || submission?.status === "approved";

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Compliance</p>
          <h1>KYC verification</h1>
          <p>
            Provide your business details to unlock live mode.{" "}
            {merchant.live_enabled
              ? "Live is currently enabled."
              : "Live is locked until KYC is approved."}
          </p>
        </div>
        <div className="topbar-actions">
          <span className={`status-pill ${submission?.status ?? "not_started"}`}>
            {submission?.status ?? "not_started"}
          </span>
        </div>
      </header>

      {submission?.status === "rejected" && submission.notes ? (
        <section className="data-card" style={{ marginBottom: 18 }}>
          <div className="data-card-header">
            <h2>Reviewer notes</h2>
          </div>
          <div style={{ padding: 16 }}>
            <p className="error">{submission.notes}</p>
            <p>Update the form below and resubmit.</p>
          </div>
        </section>
      ) : null}

      <form action={locked ? undefined : submitKycAction} className="form-panel stack">
        <h2>
          <ShieldCheck size={16} aria-hidden="true" /> Business profile
        </h2>

        {params.saved ? (
          <p className="notice">Draft saved.</p>
        ) : null}
        {params.submitted ? (
          <p className="notice">Submitted for review. We&apos;ll email you shortly.</p>
        ) : null}
        {params.error ? <p className="error">{params.error}</p> : null}

        <div className="split-grid">
          <div className="field">
            <label htmlFor="legal_name">Legal business name</label>
            <input
              className="input"
              id="legal_name"
              name="legal_name"
              required
              defaultValue={business.legal_name ?? ""}
              disabled={locked}
            />
          </div>
          <div className="field">
            <label htmlFor="tax_id">Tax ID (NIF / CIN)</label>
            <input
              className="input"
              id="tax_id"
              name="tax_id"
              required
              defaultValue={business.tax_id ?? ""}
              disabled={locked}
            />
          </div>
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="business_type">Business type</label>
            <select
              className="input"
              id="business_type"
              name="business_type"
              required
              defaultValue={business.business_type ?? "individual"}
              disabled={locked}
            >
              <option value="individual">Sole proprietor</option>
              <option value="company">Company / SARL</option>
              <option value="ngo">NGO / Non-profit</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="industry">Industry</label>
            <input
              className="input"
              id="industry"
              name="industry"
              defaultValue={business.industry ?? ""}
              disabled={locked}
            />
          </div>
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="country">Country</label>
            <input
              className="input"
              id="country"
              name="country"
              required
              defaultValue={business.country ?? "Haiti"}
              disabled={locked}
            />
          </div>
          <div className="field">
            <label htmlFor="city">City</label>
            <input
              className="input"
              id="city"
              name="city"
              required
              defaultValue={business.city ?? ""}
              disabled={locked}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="address">Street address</label>
          <input
            className="input"
            id="address"
            name="address"
            required
            defaultValue={business.address ?? ""}
            disabled={locked}
          />
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="contact_name">Primary contact name</label>
            <input
              className="input"
              id="contact_name"
              name="contact_name"
              required
              defaultValue={business.contact_name ?? ""}
              disabled={locked}
            />
          </div>
          <div className="field">
            <label htmlFor="contact_phone">Primary contact phone</label>
            <input
              className="input"
              id="contact_phone"
              name="contact_phone"
              required
              defaultValue={business.contact_phone ?? ""}
              disabled={locked}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="document_urls">Supporting document URLs (one per line)</label>
          <textarea
            className="input"
            id="document_urls"
            name="document_urls"
            rows={4}
            placeholder="Links to ID, business registration, RIB, etc."
            defaultValue={docs.join("\n")}
            disabled={locked}
          />
        </div>

        <div className="row-actions">
          {!locked ? (
            <>
              <button className="button secondary" type="submit" formAction={saveDraftAction}>
                Save draft
              </button>
              <button className="button" type="submit">
                Submit for review
              </button>
            </>
          ) : (
            <p className="notice">
              Your submission is locked while under review. Contact support to make
              changes.
            </p>
          )}
        </div>
      </form>
    </>
  );
}
