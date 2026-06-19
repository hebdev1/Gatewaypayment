import {
  CreditCard,
  FileText,
  Home,
  KeyRound,
  Link2,
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
import { requireMerchant, requireUserId } from "@/lib/auth";
import { signOutAction } from "@/app/login/actions";
import { NavLink } from "./nav-link";

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
            <span className="brand-meta">{merchant.default_currency} · {merchant.live_enabled ? "Live + sandbox" : "Sandbox"}</span>
          </span>
        </div>

        <p className="nav-section-label">Overview</p>
        <nav className="nav-list" aria-label="Merchant">
          <NavLink href="/dashboard" exact>
            <Home size={16} aria-hidden="true" />
            Dashboard
          </NavLink>
          <NavLink href="/dashboard/payments">
            <ReceiptText size={16} aria-hidden="true" />
            Payments
          </NavLink>
          <NavLink href="/dashboard/refunds">
            <RotateCcw size={16} aria-hidden="true" />
            Refunds
          </NavLink>
          <NavLink href="/dashboard/links">
            <Link2 size={16} aria-hidden="true" />
            Payment links
          </NavLink>
          <NavLink href="/dashboard/invoices">
            <FileText size={16} aria-hidden="true" />
            Invoices
          </NavLink>

          <p className="nav-section-label">Developer</p>
          <NavLink href="/dashboard/api-keys">
            <KeyRound size={16} aria-hidden="true" />
            API keys
          </NavLink>
          <NavLink href="/dashboard/webhooks">
            <RadioTower size={16} aria-hidden="true" />
            Webhooks
          </NavLink>
          <NavLink href="/dashboard/provider-settings">
            <Settings size={16} aria-hidden="true" />
            Providers
          </NavLink>

          <p className="nav-section-label">Account</p>
          <NavLink href="/dashboard/kyc">
            <ShieldCheck size={16} aria-hidden="true" />
            KYC
          </NavLink>
          <NavLink href="/dashboard/settings">
            <UserCog size={16} aria-hidden="true" />
            Settings
          </NavLink>
        </nav>

        <form action={signOutAction} className="sidebar-footer">
          <button className="nav-button" type="submit">
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
