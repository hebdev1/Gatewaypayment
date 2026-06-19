"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { enrollTotpAction, verifyTotpEnrollmentAction } from "./actions";

const initial: { error?: string; verified?: boolean } = {};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function EnrollTotpForm() {
  const [state, formAction, pending] = useActionState(verifyTotpEnrollmentAction, initial);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enrolling, startTransition] = useTransition();
  const [enrollError, setEnrollError] = useState<string | null>(null);

  useEffect(() => {
    if (state.verified) {
      redirect("/dashboard/settings/security?enrolled=1");
    }
  }, [state.verified]);

  const startEnrollment = () => {
    setEnrollError(null);
    startTransition(async () => {
      try {
        const result = await enrollTotpAction();
        setEnrollment({
          factorId: result.factorId,
          qrCode: result.qrCode,
          secret: result.secret
        });
      } catch (e) {
        setEnrollError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  if (!enrollment) {
    return (
      <div className="stack">
        <h2>
          <ShieldCheck size={16} aria-hidden="true" /> Enable two-factor authentication
        </h2>
        <p>
          We&apos;ll show you a QR code to scan with your authenticator app. After scanning,
          enter the 6-digit code to confirm.
        </p>
        {enrollError ? <p className="error">{enrollError}</p> : null}
        <button className="button" type="button" disabled={enrolling} onClick={startEnrollment}>
          {enrolling ? "Generating..." : "Start enrollment"}
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <h2>
        <ShieldCheck size={16} aria-hidden="true" /> Scan this QR code
      </h2>
      <p>
        Use Google Authenticator, 1Password, Authy or any TOTP-compatible app to scan the
        code below.
      </p>

      <div
        style={{
          background: "#ffffff",
          padding: 12,
          borderRadius: 12,
          border: "1px solid var(--border)",
          width: 220,
          alignSelf: "center"
        }}
        dangerouslySetInnerHTML={{ __html: enrollment.qrCode }}
      />

      <div className="field">
        <label htmlFor="manual-secret">
          Or enter this secret manually
        </label>
        <input
          className="input mono"
          id="manual-secret"
          readOnly
          value={enrollment.secret}
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>

      <form action={formAction} className="stack">
        <input type="hidden" name="factor_id" value={enrollment.factorId} />
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
        {state.error ? <p className="error">{state.error}</p> : null}
        <div className="row-actions">
          <button className="button" type="submit" disabled={pending}>
            {pending ? "Verifying..." : "Confirm and enable"}
          </button>
        </div>
      </form>
    </div>
  );
}
