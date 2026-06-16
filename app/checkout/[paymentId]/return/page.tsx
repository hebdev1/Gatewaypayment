import Link from "next/link";
import { CheckCircle2, RotateCw } from "lucide-react";
import { requireEnv } from "@/lib/env";

async function verifyPayment(paymentId: string) {
  const response = await fetch(`${requireEnv("SUPABASE_FUNCTIONS_URL")}/verify-payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": requireEnv("INTERNAL_FUNCTION_SECRET")
    },
    body: JSON.stringify({ payment_id: paymentId }),
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      ok: false,
      status: "verification_failed",
      message: await response.text()
    };
  }

  return response.json() as Promise<{
    ok: boolean;
    payment: {
      id: string;
      status: string;
      merchant_order_id: string;
    };
  }>;
}

export default async function CheckoutReturnPage({
  params
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const result = await verifyPayment(paymentId);
  const status = "payment" in result ? result.payment.status : result.status;

  return (
    <main className="checkout-shell">
      <section className="checkout-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Payment status</p>
            <h1>{status === "succeeded" ? "Payment confirmed" : "Payment pending"}</h1>
          </div>
          <div className="brand-mark">
            {status === "succeeded" ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <RotateCw size={18} aria-hidden="true" />
            )}
          </div>
        </div>
        <p>
          <span className={`status-pill ${status}`}>{status}</span>
        </p>
        <Link className="button secondary full" href={`/checkout/${paymentId}`}>
          Back to checkout
        </Link>
      </section>
    </main>
  );
}
