import Link from "next/link";
import { Store } from "lucide-react";
import { signUpAction } from "@/app/login/actions";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Merchant registration</p>
            <h1>Create account</h1>
          </div>
          <div className="brand-mark">
            <Store size={18} aria-hidden="true" />
          </div>
        </div>

        <form action={signUpAction} className="stack">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
            />
          </div>
          {params.error ? <p className="error">{params.error}</p> : null}
          <button className="button full" type="submit">
            Register
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
