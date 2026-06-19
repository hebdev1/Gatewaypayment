import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EnrollTotpForm } from "./enroll-form";
import { unenrollFactorAction } from "./actions";

type Factor = {
  id: string;
  friendly_name: string | null;
  factor_type: string;
  status: "unverified" | "verified";
  created_at: string;
};

export default async function SecurityPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; enrolled?: string }>;
}) {
  await requireUserId();
  const params = await searchParams;
  const supabase = await createClient();

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = (factorsData?.totp ?? []) as unknown as Factor[];
  const hasVerified = verifiedTotp.some((f) => f.status === "verified");

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            <Link href="/dashboard/settings" style={{ color: "var(--text-tertiary)" }}>
              ← Settings
            </Link>
          </p>
          <h1>Security</h1>
          <p>Two-factor authentication adds a one-time code on top of your password.</p>
        </div>
      </header>

      {params.error ? <p className="error">{decodeURIComponent(params.error)}</p> : null}
      {params.enrolled ? (
        <p className="notice" style={{ marginBottom: 20 }}>
          Two-factor authentication is now enabled.
        </p>
      ) : null}

      <section className="data-card">
        <div className="data-card-header">
          <h2>
            <ShieldCheck size={16} aria-hidden="true" /> Authenticator app (TOTP)
          </h2>
          <span className={`status-pill ${hasVerified ? "succeeded" : ""}`}>
            {hasVerified ? "Enabled" : "Not configured"}
          </span>
        </div>

        <div style={{ padding: 20 }}>
          {verifiedTotp.length === 0 ? (
            <p>
              Add a TOTP factor (Google Authenticator, 1Password, Authy, etc.). You&apos;ll
              need a code from your app every time you sign in.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Added</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedTotp.map((factor) => (
                    <tr key={factor.id}>
                      <td>{factor.friendly_name ?? "Authenticator"}</td>
                      <td>
                        <span className={`status-pill ${factor.status === "verified" ? "succeeded" : "pending"}`}>
                          {factor.status}
                        </span>
                      </td>
                      <td>{new Date(factor.created_at).toLocaleString()}</td>
                      <td>
                        <form action={unenrollFactorAction}>
                          <input type="hidden" name="factor_id" value={factor.id} />
                          <button className="button secondary" type="submit">
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {!hasVerified ? (
        <section className="form-panel" style={{ marginTop: 20 }}>
          <EnrollTotpForm />
        </section>
      ) : null}
    </>
  );
}
