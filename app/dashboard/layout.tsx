import Link from "next/link";
import {
  CreditCard,
  Home,
  KeyRound,
  LogOut,
  RadioTower,
  ReceiptText,
  RotateCcw,
  Settings,
  ShieldCheck,
  UserCog
} from "lucide-react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserId } from "@/lib/auth";
import { signOutAction } from "@/app/login/actions";
import { requireMerchant } from "@/lib/auth";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Admins go straight to /admin; the merchant panel is for merchants only.
  const userId = await requireUserId();
  const admin = createAdminClient();
  const { data: adminRow } = await admin
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (adminRow) {
    redirect("/admin");
  }

  const { merchant } = await requireMerchant();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="side-title">
          <span className="brand-mark">
            <CreditCard size={17} aria-hidden="true" />
          </span>
          <span className="brand-copy">
            <span className="brand-name">{merchant.display_name}</span>
            <span className="brand-meta">{merchant.default_currency} settlement</span>
          </span>
        </div>
        <nav className="nav-list" aria-label="Merchant">
          <Link className="nav-link" href="/dashboard">
            <Home size={17} aria-hidden="true" />
            Dashboard
          </Link>
          <Link className="nav-link" href="/dashboard/payments">
            <ReceiptText size={17} aria-hidden="true" />
            Payments
          </Link>
          <Link className="nav-link" href="/dashboard/refunds">
            <RotateCcw size={17} aria-hidden="true" />
            Refunds
          </Link>
          <Link className="nav-link" href="/dashboard/api-keys">
            <KeyRound size={17} aria-hidden="true" />
            API keys
          </Link>
          <Link className="nav-link" href="/dashboard/provider-settings">
            <Settings size={17} aria-hidden="true" />
            Providers
          </Link>
          <Link className="nav-link" href="/dashboard/webhooks">
            <RadioTower size={17} aria-hidden="true" />
            Webhooks
          </Link>
          <Link className="nav-link" href="/dashboard/kyc">
            <ShieldCheck size={17} aria-hidden="true" />
            KYC
          </Link>
          <Link className="nav-link" href="/dashboard/settings">
            <UserCog size={17} aria-hidden="true" />
            Settings
          </Link>
          <form action={signOutAction} className="sidebar-footer">
            <button className="nav-button" type="submit">
              <LogOut size={17} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
