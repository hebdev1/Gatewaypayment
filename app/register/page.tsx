import Link from "next/link";
import { Store } from "lucide-react";
import { getT } from "@/lib/i18n";
import { LocaleSwitcher } from "@/app/_locale-switcher";
import { signUpAction } from "@/app/login/actions";

export default async function RegisterPage({
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
            <p className="eyebrow">{t("auth.register.eyebrow")}</p>
            <h1>{t("auth.register.title")}</h1>
          </div>
          <div className="brand-mark">
            <Store size={18} aria-hidden="true" />
          </div>
        </div>

        <form action={signUpAction} className="stack">
          <div className="field">
            <label htmlFor="email">{t("common.email")}</label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">{t("common.password")}</label>
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
            {t("common.signup.cta")}
          </button>
        </form>

        <p className="auth-switch">
          <Link href="/login">{t("auth.register.alreadyHave")}</Link>
        </p>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <LocaleSwitcher current={locale} next="/register" />
        </div>
      </section>
    </main>
  );
}
