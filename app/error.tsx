"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Something went wrong</p>
            <h1>Unexpected error</h1>
          </div>
        </div>
        <p>
          The page could not be loaded. The error has been logged and we&apos;ll look
          into it.
        </p>
        {error.digest ? (
          <p className="mono small">Reference: {error.digest}</p>
        ) : null}
        <div className="row-actions" style={{ marginTop: 14 }}>
          <button className="button" onClick={() => reset()} type="button">
            Try again
          </button>
          <Link className="button secondary" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
