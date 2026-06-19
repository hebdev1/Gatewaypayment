import { FileText, ShieldCheck, Trash2 } from "lucide-react";
import { requireMerchant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { removeKycDocumentAction, saveDraftAction, submitKycAction } from "./actions";

type StoredDocument = {
  name: string;
  storage_path: string;
  content_type: string;
  size: number;
  uploaded_at: string;
};

type Submission = {
  id: string;
  status: "not_started" | "draft" | "submitted" | "approved" | "rejected";
  business_data: Record<string, string>;
  document_urls: StoredDocument[];
  submitted_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const docs = Array.isArray(submission?.document_urls)
    ? (submission!.document_urls as StoredDocument[])
    : [];
  const locked = submission?.status === "submitted" || submission?.status === "approved";

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Compliance</p>
          <h1>KYC verification</h1>
          <p>
            Provide your business details and documents to unlock live mode.{" "}
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

      <form
        action={locked ? undefined : submitKycAction}
        className="form-panel stack"
        encType="multipart/form-data"
      >
        <h2>
          <ShieldCheck size={16} aria-hidden="true" /> Business profile
        </h2>

        {params.saved ? <p className="notice">Draft saved.</p> : null}
        {params.submitted ? (
          <p className="notice">Submitted for review. We&apos;ll email you shortly.</p>
        ) : null}
        {params.error ? <p className="error">{decodeURIComponent(params.error)}</p> : null}

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
          <label htmlFor="documents">Supporting documents (PDF, JPG, PNG; 10 MB max each)</label>
          <input
            className="input"
            id="documents"
            name="documents"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={locked}
          />
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>
            Upload your business registration, ID, and (if available) bank statement.
            Documents are stored privately; only the HaitiPay review team can see them.
          </p>
        </div>

        {docs.length ? (
          <div className="data-card" style={{ border: 0, boxShadow: "none" }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Uploaded</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.storage_path}>
                      <td>
                        <FileText size={13} aria-hidden="true" style={{ marginRight: 6, verticalAlign: -2 }} />
                        {doc.name}
                      </td>
                      <td>{doc.content_type?.split("/")[1] ?? "—"}</td>
                      <td>{formatSize(doc.size)}</td>
                      <td>{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : "—"}</td>
                      <td>
                        {!locked ? (
                          <form action={removeKycDocumentAction}>
                            <input type="hidden" name="path" value={doc.storage_path} />
                            <button className="button secondary" type="submit">
                              <Trash2 size={12} aria-hidden="true" /> Remove
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

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
