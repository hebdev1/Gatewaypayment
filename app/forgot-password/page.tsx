import Link from "next/link";
import { Mail } from "lucide-react";
import { sendPasswordResetAction } from "./actions";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Account recovery</p>
            <h1>Reset your password</h1>
          </div>
          <div className="brand-mark">
            <Mail size={18} aria-hidden="true" />
          </div>
        </div>

        {params.sent ? (
          <p className="notice">
            If an account exists for that email, a reset link has been sent.
            Check your inbox.
          </p>
        ) : (
          <form action={sendPasswordResetAction} className="stack">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            {params.error ? <p className="error">{params.error}</p> : null}
            <button className="button full" type="submit">
              Send reset link
            </button>
          </form>
        )}

        <p className="auth-switch">
          Remembered it? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
