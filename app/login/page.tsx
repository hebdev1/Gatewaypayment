import Link from "next/link";
import { CreditCard } from "lucide-react";
import { getT } from "@/lib/i18n";
import { LocaleSwitcher } from "@/app/_locale-switcher";
import { signInAction } from "./actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const { locale, t } = await getT(new URLSearchParams(params as Record<string, string>));

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">{t("auth.login.eyebrow")}</p>
            <h1>{t("auth.login.title")}</h1>
          </div>
          <div className="brand-mark">
            <CreditCard size={18} aria-hidden="true" />
          </div>
        </div>

        <form action={signInAction} className="stack">
          <div className="field">
            <label htmlFor="email">{t("common.email")}</label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">{t("common.password")}</label>
            <input className="input" id="password" name="password" type="password" required />
          </div>
          {params.error ? <p className="error">{params.error}</p> : null}
          <button className="button full" type="submit">
            {t("common.signin.cta")}
          </button>
        </form>

        <p className="auth-switch">
          <Link href="/forgot-password">{t("auth.login.forgot")}</Link>
        </p>
        <p className="auth-switch">
          <Link href="/register">{t("auth.login.newMerchant")}</Link>
        </p>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <LocaleSwitcher current={locale} next="/login" />
        </div>
      </section>
    </main>
  );
}
