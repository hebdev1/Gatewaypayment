import {
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  RadioTower,
  ReceiptText,
  ShieldCheck,
  Store
} from "lucide-react";
import { signOutAction } from "@/app/login/actions";
import { requireAdmin } from "@/lib/admin";
import { NavLink } from "@/app/dashboard/nav-link";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="side-title">
          <span className="brand-mark">
            <ShieldCheck size={17} aria-hidden="true" />
          </span>
          <span className="brand-copy">
            <span className="brand-name">HaitiPay Admin</span>
            <span className="brand-meta">{admin.role} · {admin.email}</span>
          </span>
        </div>

        <p className="nav-section-label">Operations</p>
        <nav className="nav-list" aria-label="Admin">
          <NavLink href="/admin" exact>
            <LayoutDashboard size={16} aria-hidden="true" />
            Overview
          </NavLink>
          <NavLink href="/admin/merchants">
            <Store size={16} aria-hidden="true" />
            Merchants
          </NavLink>
          <NavLink href="/admin/kyc">
            <ClipboardCheck size={16} aria-hidden="true" />
            KYC queue
          </NavLink>

          <p className="nav-section-label">Activity</p>
          <NavLink href="/admin/payments">
            <ReceiptText size={16} aria-hidden="true" />
            Payments
          </NavLink>
          <NavLink href="/admin/webhooks">
            <RadioTower size={16} aria-hidden="true" />
            Webhook deliveries
          </NavLink>
          <NavLink href="/admin/payouts">
            <ReceiptText size={16} aria-hidden="true" />
            Payouts queue
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
