import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveKycAction, rejectKycAction } from "./actions";

type KycSubmission = {
  id: string;
  merchant_id: string;
  status: string;
  business_data: Record<string, string>;
  document_urls: Array<
    | string
    | {
        name: string;
        storage_path: string;
        content_type: string;
        size: number;
        uploaded_at: string;
      }
  >;
  submitted_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  merchants: { display_name: string; legal_name: string | null } | null;
};

export default async function AdminKycReviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("kyc_submissions")
    .select("*, merchants(display_name, legal_name)")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  const submission = data as unknown as KycSubmission;
  const business = submission.business_data ?? {};
  const docs = submission.document_urls ?? [];
  const isPending = submission.status === "submitted";

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            <Link href="/admin/kyc">
              <ChevronLeft size={14} aria-hidden="true" /> KYC queue
            </Link>
          </p>
          <h1>{submission.merchants?.display_name ?? "Merchant"}</h1>
          <p className="mono">submission {submission.id}</p>
        </div>
        <div className="topbar-actions">
          <span className={`status-pill ${submission.status}`}>{submission.status}</span>
        </div>
      </header>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Business profile</h2>
        </div>
        <dl className="kv-grid">
          <div>
            <dt>Legal name</dt>
            <dd>{business.legal_name ?? "—"}</dd>
          </div>
          <div>
            <dt>Tax ID</dt>
            <dd className="mono">{business.tax_id ?? "—"}</dd>
          </div>
          <div>
            <dt>Business type</dt>
            <dd>{business.business_type ?? "—"}</dd>
          </div>
          <div>
            <dt>Industry</dt>
            <dd>{business.industry ?? "—"}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{business.country ?? "—"}</dd>
          </div>
          <div>
            <dt>City</dt>
            <dd>{business.city ?? "—"}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{business.address ?? "—"}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>
              {business.contact_name ?? "—"}
              {business.contact_phone ? ` · ${business.contact_phone}` : null}
            </dd>
          </div>
        </dl>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Documents ({docs.length})</h2>
        </div>
        <ul style={{ padding: 16, color: "var(--text-secondary)" }}>
          {docs.length === 0 ? (
            <li className="empty">No documents provided.</li>
          ) : (
            docs.map((doc, i) => {
              if (typeof doc === "string") {
                return (
                  <li key={i} style={{ marginBottom: 6 }}>
                    <a href={doc} className="mono" target="_blank" rel="noreferrer">
                      {doc}
                    </a>
                  </li>
                );
              }
              const href = `/api/kyc/document?path=${encodeURIComponent(doc.storage_path)}`;
              return (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--divider)"
                  }}
                >
                  <span>
                    <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 600 }}>
                      {doc.name}
                    </a>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 12, marginLeft: 8 }}>
                      {doc.content_type} ·{" "}
                      {doc.size < 1024 * 1024
                        ? `${(doc.size / 1024).toFixed(1)} KB`
                        : `${(doc.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                  </span>
                  <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                    {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : ""}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Decision</h2>
        </div>
        {isPending ? (
          <div style={{ padding: 16, display: "grid", gap: 14 }}>
            <form action={approveKycAction} className="stack">
              <input type="hidden" name="submission_id" value={submission.id} />
              <div className="field">
                <label htmlFor="approve-notes">Notes (optional)</label>
                <textarea
                  className="input"
                  id="approve-notes"
                  name="notes"
                  rows={2}
                  placeholder="e.g. all documents verified"
                />
              </div>
              <button className="button" type="submit">
                Approve & enable live mode
              </button>
            </form>

            <form action={rejectKycAction} className="stack">
              <input type="hidden" name="submission_id" value={submission.id} />
              <div className="field">
                <label htmlFor="reject-notes">Rejection reason (required)</label>
                <textarea
                  className="input"
                  id="reject-notes"
                  name="notes"
                  rows={2}
                  required
                  placeholder="e.g. unreadable ID document"
                />
              </div>
              <button className="button secondary" type="submit">
                Reject
              </button>
            </form>
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            <p>
              Already <strong>{submission.status}</strong>{" "}
              {submission.reviewed_at
                ? `on ${new Date(submission.reviewed_at).toLocaleString()}`
                : null}
              .
            </p>
            {submission.notes ? <p className="notice">{submission.notes}</p> : null}
          </div>
        )}
      </section>
    </>
  );
}
