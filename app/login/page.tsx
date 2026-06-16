import Link from "next/link";
import { CreditCard } from "lucide-react";
import { signInAction } from "./actions";

export default async function LoginPage({
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
            <p className="eyebrow">Merchant access</p>
            <h1>HaitiPay</h1>
          </div>
          <div className="brand-mark">
            <CreditCard size={18} aria-hidden="true" />
          </div>
        </div>

        <form action={signInAction} className="stack">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" required />
          </div>
          {params.error ? <p className="error">{params.error}</p> : null}
          <button className="button full" type="submit">
            Sign in
          </button>
        </form>

        <p className="auth-switch">
          New merchant? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
