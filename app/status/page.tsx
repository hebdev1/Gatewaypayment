import { CheckCircle2, ChevronLeft, CircleAlert, CircleX } from "lucide-react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export const metadata = {
  title: "Status",
  description: "Live health status of the HaitiPay gateway"
};

type Health = "operational" | "degraded" | "outage" | "unknown";

function dot(health: Health) {
  switch (health) {
    case "operational":
      return <CheckCircle2 size={16} aria-hidden="true" style={{ color: "var(--success)" }} />;
    case "degraded":
      return <CircleAlert size={16} aria-hidden="true" style={{ color: "var(--warning)" }} />;
    case "outage":
      return <CircleX size={16} aria-hidden="true" style={{ color: "var(--danger)" }} />;
    default:
      return <CircleAlert size={16} aria-hidden="true" style={{ color: "var(--text-tertiary)" }} />;
  }
}

function label(health: Health) {
  switch (health) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "outage":
      return "Outage";
    default:
      return "Unknown";
  }
}

async function checkDispatcher(admin: ReturnType<typeof createAdminClient>): Promise<{
  health: Health;
  successRate: number;
  recent: number;
}> {
  const { data, error } = await admin
    .from("net._http_response" as never)
    .select("status_code")
    .limit(0);
  // Try via RPC instead since net is restricted from PostgREST.
  // Fall back: read webhook_deliveries health directly.
  if (error) {
    const { data: del } = await admin
      .from("webhook_deliveries")
      .select("status", { count: "exact" })
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
      .limit(1000);

    if (!del?.length) return { health: "operational", successRate: 1, recent: 0 };
    const succeeded = del.filter((d) => d.status === "succeeded").length;
    const total = del.length;
    const rate = succeeded / total;
    const health: Health = rate >= 0.9 ? "operational" : rate >= 0.5 ? "degraded" : "outage";
    return { health, successRate: rate, recent: total };
  }
  return { health: "unknown", successRate: 0, recent: 0 };
}

async function checkPayments(admin: ReturnType<typeof createAdminClient>): Promise<{
  health: Health;
  total24h: number;
}> {
  const { data, error } = await admin
    .from("payments")
    .select("status", { count: "exact" })
    .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .limit(1000);

  if (error) return { health: "unknown", total24h: 0 };
  return { health: "operational", total24h: data?.length ?? 0 };
}

async function checkDb(admin: ReturnType<typeof createAdminClient>): Promise<Health> {
  const { error } = await admin.from("merchants").select("id").limit(1);
  return error ? "outage" : "operational";
}

async function checkEmail(admin: ReturnType<typeof createAdminClient>): Promise<{
  health: Health;
  pending: number;
  failed: number;
}> {
  const [{ count: pendingCount }, { count: failedCount }] = await Promise.all([
    admin
      .from("email_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("email_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
  ]);

  const pending = pendingCount ?? 0;
  const failed = failedCount ?? 0;

  const health: Health = failed > 5 ? "degraded" : pending > 50 ? "degraded" : "operational";
  return { health, pending, failed };
}

export default async function StatusPage() {
  const admin = createAdminClient();

  const [dispatcher, payments, dbHealth, email] = await Promise.all([
    checkDispatcher(admin),
    checkPayments(admin),
    checkDb(admin),
    checkEmail(admin)
  ]);

  const overall: Health =
    dbHealth === "outage" || dispatcher.health === "outage"
      ? "outage"
      : dbHealth === "degraded" || dispatcher.health === "degraded" || email.health === "degraded"
      ? "degraded"
      : "operational";

  const services = [
    { name: "Database", description: "Postgres availability", health: dbHealth },
    {
      name: "Payments API",
      description: "create-payment, verify-payment, create-refund",
      health: payments.health,
      meta: `${payments.total24h} payments in last 24 h`
    },
    {
      name: "Outbound webhooks",
      description: "Dispatch + delivery success",
      health: dispatcher.health,
      meta: `${Math.round(dispatcher.successRate * 100)}% delivery rate over ${dispatcher.recent} attempts (24 h)`
    },
    {
      name: "Email delivery",
      description: "Transactional emails (Resend)",
      health: email.health,
      meta: `${email.pending} pending · ${email.failed} failed`
    }
  ];

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
      <p className="eyebrow">
        <Link href="/" style={{ color: "var(--text-tertiary)" }}>
          <ChevronLeft size={12} aria-hidden="true" /> Back to HaitiPay
        </Link>
      </p>

      <section
        className="data-card"
        style={{ padding: 24, marginTop: 12, marginBottom: 24, border: 0 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>
              All systems {overall === "operational" ? "operational" : label(overall).toLowerCase()}
            </h1>
            <p style={{ marginTop: 8 }}>
              Last updated {new Date().toLocaleString()}
            </p>
          </div>
          <span
            className={`status-pill ${
              overall === "operational"
                ? "succeeded"
                : overall === "degraded"
                ? "pending"
                : "failed"
            }`}
            style={{ height: 28, padding: "0 14px", fontSize: 12 }}
          >
            {dot(overall)} {label(overall)}
          </span>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2>Components</h2>
        </div>
        <ul style={{ padding: 0 }}>
          {services.map((s) => (
            <li
              key={s.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "16px 24px",
                borderBottom: "1px solid var(--divider)"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {dot(s.health)}
                  <strong style={{ color: "var(--text-primary)", fontSize: 14 }}>{s.name}</strong>
                </div>
                <p style={{ marginTop: 4, fontSize: 13 }}>
                  {s.description}
                  {s.meta ? ` · ${s.meta}` : null}
                </p>
              </div>
              <span
                className={`status-pill ${
                  s.health === "operational"
                    ? "succeeded"
                    : s.health === "degraded"
                    ? "pending"
                    : s.health === "outage"
                    ? "failed"
                    : ""
                }`}
              >
                {label(s.health)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p
        style={{
          marginTop: 24,
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: 12
        }}
      >
        Status auto-refreshes every 30 seconds.
      </p>
    </main>
  );
}
