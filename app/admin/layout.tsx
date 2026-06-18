import Link from "next/link";
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
        <nav className="nav-list" aria-label="Admin">
          <Link className="nav-link" href="/admin">
            <LayoutDashboard size={17} aria-hidden="true" />
            Overview
          </Link>
          <Link className="nav-link" href="/admin/merchants">
            <Store size={17} aria-hidden="true" />
            Merchants
          </Link>
          <Link className="nav-link" href="/admin/kyc">
            <ClipboardCheck size={17} aria-hidden="true" />
            KYC queue
          </Link>
          <Link className="nav-link" href="/admin/payments">
            <ReceiptText size={17} aria-hidden="true" />
            Payments
          </Link>
          <Link className="nav-link" href="/admin/webhooks">
            <RadioTower size={17} aria-hidden="true" />
            Webhook deliveries
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
