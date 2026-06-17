"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: "#eef2f6",
          color: "#121417",
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24
        }}
      >
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #d7dee8",
            borderRadius: 8,
            padding: 24,
            maxWidth: 440,
            boxShadow: "0 18px 48px rgba(15,23,42,0.07)"
          }}
        >
          <p style={{ color: "#667085", fontSize: 13, margin: "0 0 4px" }}>
            Critical error
          </p>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>HaitiPay is unavailable</h1>
          <p style={{ color: "#243041", lineHeight: 1.5 }}>
            A critical error prevented the app from loading. We&apos;ve been notified.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#667085" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 14,
              minHeight: 40,
              border: 0,
              borderRadius: 8,
              padding: "9px 13px",
              background: "#0f766e",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Try again
          </button>
        </section>
      </body>
    </html>
  );
}
