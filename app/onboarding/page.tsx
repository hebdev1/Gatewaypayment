import { Building2 } from "lucide-react";
import { createMerchantAction } from "./actions";
import { requireUserId } from "@/lib/auth";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUserId();
  const params = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Business profile</p>
            <h1>Merchant setup</h1>
          </div>
          <div className="brand-mark">
            <Building2 size={18} aria-hidden="true" />
          </div>
        </div>

        <form action={createMerchantAction} className="stack">
          <div className="field">
            <label htmlFor="display_name">Display name</label>
            <input className="input" id="display_name" name="display_name" required />
          </div>
          <div className="field">
            <label htmlFor="legal_name">Legal name</label>
            <input className="input" id="legal_name" name="legal_name" />
          </div>
          <div className="field">
            <label htmlFor="email">Business email</label>
            <input className="input" id="email" name="email" type="email" />
          </div>
          <div className="field">
            <label htmlFor="phone">Business phone</label>
            <input className="input" id="phone" name="phone" />
          </div>
          {params.error ? <p className="error">{params.error}</p> : null}
          <button className="button full" type="submit">
            Create merchant
          </button>
        </form>
      </section>
    </main>
  );
}
