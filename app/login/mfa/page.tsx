import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { verifyLoginMfaAction } from "./actions";

export default async function LoginMfaPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.claims?.sub) {
    redirect("/login");
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalData?.currentLevel === "aal2") {
    // Already verified — let HomePage decide where to go.
    redirect("/");
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = (factorsData?.totp ?? []).filter((f) => f.status === "verified");

  if (!verifiedTotp.length) {
    redirect("/");
  }

  const factorId = verifiedTotp[0].id;

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Two-factor authentication</p>
            <h1>Enter your code</h1>
          </div>
          <div className="brand-mark">
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
        </div>
        <p>Open your authenticator app and enter the 6-digit code for HaitiPay.</p>

        <form action={verifyLoginMfaAction} className="stack" style={{ marginTop: 16 }}>
          <input type="hidden" name="factor_id" value={factorId} />
          <div className="field">
            <label htmlFor="code">6-digit code</label>
            <input
              className="input mono"
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              minLength={6}
              pattern="[0-9]{6}"
              required
              autoFocus
            />
          </div>
          {params.error ? <p className="error">{decodeURIComponent(params.error)}</p> : null}
          <button className="button full" type="submit">
            Verify
          </button>
        </form>
      </section>
    </main>
  );
}
