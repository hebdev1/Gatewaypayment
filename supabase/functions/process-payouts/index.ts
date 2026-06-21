import { getEnv } from "../_shared/env.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { getMasterAdapter } from "../_shared/providers/index.ts";
import { ProviderCapabilityError, ProviderTemporaryError } from "../_shared/providers/types.ts";
import { adminClient } from "../_shared/supabase.ts";

function requirePayoutsProcessorSecret(request: Request) {
  const provided = request.headers.get("x-internal-secret");
  const allowed = [
    getEnv("PAYOUTS_PROCESSOR_SECRET"),
    getEnv("DISPATCHER_SECRET"),
    getEnv("INTERNAL_FUNCTION_SECRET")
  ].filter(Boolean);
  if (!provided || !allowed.includes(provided)) {
    throw new Response("Unauthorized.", { status: 401 });
  }
}

type PayoutRow = {
  id: string;
  merchant_id: string;
  mode: "sandbox" | "live";
  destination_id: string | null;
  destination_snapshot: {
    type?: string;
    moncash_phone?: string;
  };
  amount_gross: string;
  attempts: number;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return errorResponse("Method not allowed.", 405, "method_not_allowed");
  }

  try {
    requirePayoutsProcessorSecret(request);
  } catch (error) {
    if (error instanceof Response) return error;
    return errorResponse("Unauthorized.", 401);
  }

  const supabase = adminClient();

  // Pick a small batch of pending payouts whose scheduled_for is in the past
  const { data: pending, error } = await supabase
    .from("payouts")
    .select(
      "id, merchant_id, mode, destination_id, destination_snapshot, amount_gross, attempts"
    )
    .in("status", ["pending", "failed"])
    .lt("attempts", 5)
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(20);

  if (error) {
    return errorResponse(error.message, 500, "payout_lookup_failed");
  }

  // Cache adapters per (mode) to reuse the OAuth token within a batch
  const adapters: Record<"sandbox" | "live", ReturnType<typeof getMasterAdapter> | null> = {
    sandbox: null,
    live: null
  };

  function adapterFor(mode: "sandbox" | "live") {
    if (adapters[mode]) return adapters[mode]!;
    adapters[mode] = getMasterAdapter(mode);
    return adapters[mode]!;
  }

  // Optional balance pre-check per mode (skip the batch if wallet is too low)
  const balances: Record<string, number> = {};
  async function ensureBalance(mode: "sandbox" | "live", required: number): Promise<boolean> {
    if (!(mode in balances)) {
      try {
        balances[mode] = await adapterFor(mode).getPrefundedBalance();
      } catch {
        balances[mode] = Number.POSITIVE_INFINITY; // proceed if check fails
      }
    }
    return balances[mode] >= required;
  }

  const results: Array<{ id: string; outcome: string }> = [];

  for (const row of (pending ?? []) as PayoutRow[]) {
    // Validate destination
    const snap = row.destination_snapshot ?? {};
    if (snap.type !== "moncash" || !snap.moncash_phone) {
      await markAwaitingManual(
        supabase,
        row.id,
        `Destination type "${snap.type}" requires manual processing.`
      );
      results.push({ id: row.id, outcome: "awaiting_manual" });
      continue;
    }

    const amount = Number(row.amount_gross);

    if (!(await ensureBalance(row.mode, amount))) {
      await rescheduleForLater(
        supabase,
        row.id,
        row.attempts + 1,
        "Master wallet balance is below this payout."
      );
      results.push({ id: row.id, outcome: "deferred_low_balance" });
      continue;
    }

    await supabase
      .from("payouts")
      .update({ status: "processing", attempted_at: new Date().toISOString() })
      .eq("id", row.id);

    try {
      const adapter = adapterFor(row.mode);
      const result = await adapter.payout({
        destinationPhone: snap.moncash_phone,
        amount,
        reference: `HP-PAYOUT-${row.id.slice(0, 8)}`
      });

      await supabase
        .from("payouts")
        .update({
          status: result.status === "succeeded" ? "succeeded" : "pending",
          completed_at: result.status === "succeeded" ? new Date().toISOString() : null,
          provider_transaction_id: result.providerTransactionId,
          provider_response: (result.raw ?? {}) as Record<string, unknown>,
          attempts: row.attempts + 1,
          last_error: null
        })
        .eq("id", row.id);

      results.push({ id: row.id, outcome: result.status });
    } catch (err) {
      if (err instanceof ProviderCapabilityError) {
        await markAwaitingManual(
          supabase,
          row.id,
          `Provider capability error: ${err.code} — ${err.message}`
        );
        results.push({ id: row.id, outcome: "awaiting_manual" });
      } else if (err instanceof ProviderTemporaryError) {
        await rescheduleForLater(supabase, row.id, row.attempts + 1, err.message);
        results.push({ id: row.id, outcome: "retry" });
      } else {
        const nextAttempts = row.attempts + 1;
        const isTerminal = nextAttempts >= 5;
        if (isTerminal) {
          await markAwaitingManual(
            supabase,
            row.id,
            `Retries exhausted. Last error: ${err instanceof Error ? err.message : String(err)}`
          );
          results.push({ id: row.id, outcome: "awaiting_manual" });
        } else {
          await rescheduleForLater(
            supabase,
            row.id,
            nextAttempts,
            err instanceof Error ? err.message : String(err)
          );
          results.push({ id: row.id, outcome: "retry" });
        }
      }
    }
  }

  return jsonResponse({ processed: results.length, results });
});

async function rescheduleForLater(
  supabase: ReturnType<typeof adminClient>,
  payoutId: string,
  newAttempts: number,
  errorMessage: string
) {
  const backoffMin = Math.min(60, Math.pow(2, newAttempts));
  await supabase
    .from("payouts")
    .update({
      status: "failed",
      attempts: newAttempts,
      last_error: errorMessage,
      scheduled_for: new Date(Date.now() + backoffMin * 60_000).toISOString()
    })
    .eq("id", payoutId);
}

async function markAwaitingManual(
  supabase: ReturnType<typeof adminClient>,
  payoutId: string,
  errorMessage: string
) {
  await supabase
    .from("payouts")
    .update({
      status: "awaiting_manual",
      last_error: errorMessage
    })
    .eq("id", payoutId);
}
