import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updatePasswordAction } from "./actions";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // The user must be authenticated via the recovery link before they can
  // set a new password. The /auth/callback handler exchanges the code first,
  // so if there is no session here, the link was invalid or expired.
  if (!data?.claims?.sub) {
    redirect("/forgot-password?error=Reset%20link%20is%20invalid%20or%20has%20expired.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Account recovery</p>
            <h1>Choose a new password</h1>
          </div>
          <div className="brand-mark">
            <KeyRound size={18} aria-hidden="true" />
          </div>
        </div>

        <form action={updatePasswordAction} className="stack">
          <div className="field">
            <label htmlFor="password">New password</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="password_confirmation">Confirm password</label>
            <input
              className="input"
              id="password_confirmation"
              name="password_confirmation"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          {params.error ? <p className="error">{params.error}</p> : null}
          <button className="button full" type="submit">
            Update password
          </button>
        </form>

        <p className="auth-switch">
          <Link href="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}
