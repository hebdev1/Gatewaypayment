import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">404</p>
            <h1>Page not found</h1>
          </div>
        </div>
        <p>This page doesn&apos;t exist or has moved.</p>
        <div className="row-actions" style={{ marginTop: 14 }}>
          <Link className="button" href="/dashboard">
            Back to dashboard
          </Link>
          <Link className="button secondary" href="/login">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
