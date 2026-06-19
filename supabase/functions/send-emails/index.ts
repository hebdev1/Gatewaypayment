import { requireEmailSenderSecret } from "../_shared/auth.ts";
import { getEnv } from "../_shared/env.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

const RESEND_API = "https://api.resend.com/emails";

async function sendViaResend(payload: {
  apiKey: string;
  from: string;
  replyTo?: string | null;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
}) {
  const response = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${payload.apiKey}`
    },
    body: JSON.stringify({
      from: payload.from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      ...(payload.text ? { text: payload.text } : {}),
      ...(payload.replyTo ? { reply_to: payload.replyTo } : {})
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend HTTP ${response.status}: ${body || "no body"}`);
  }

  const data = await response.json().catch(() => ({}));
  return data?.id ?? null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed.", 405, "method_not_allowed");
  }

  try {
    requireEmailSenderSecret(request);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Unauthorized.", 401, "unauthorized");
  }

  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("EMAIL_FROM");

  if (!apiKey || !from) {
    return errorResponse(
      "RESEND_API_KEY and EMAIL_FROM must be configured.",
      500,
      "email_provider_not_configured"
    );
  }

  const supabase = adminClient();

  const { data: pending, error } = await supabase
    .from("email_outbox")
    .select("id, to_address, reply_to, subject, body_html, body_text, attempts")
    .in("status", ["pending", "failed"])
    .lte("send_at", new Date().toISOString())
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return errorResponse(error.message, 500, "outbox_lookup_failed");
  }

  let processed = 0;
  let failed = 0;

  for (const row of pending ?? []) {
    await supabase.from("email_outbox").update({ status: "sending" }).eq("id", row.id);

    try {
      await sendViaResend({
        apiKey,
        from,
        to: row.to_address,
        replyTo: row.reply_to,
        subject: row.subject,
        html: row.body_html,
        text: row.body_text
      });

      await supabase
        .from("email_outbox")
        .update({
          status: "sent",
          attempts: row.attempts + 1,
          sent_at: new Date().toISOString(),
          last_error: null
        })
        .eq("id", row.id);

      processed += 1;
    } catch (err) {
      failed += 1;
      await supabase
        .from("email_outbox")
        .update({
          status: "failed",
          attempts: row.attempts + 1,
          last_error: err instanceof Error ? err.message : String(err),
          send_at: new Date(Date.now() + Math.min(60, 2 ** row.attempts) * 60_000).toISOString()
        })
        .eq("id", row.id);
    }
  }

  return jsonResponse({ processed, failed });
});
