import { getEnv } from "./env.ts";
import { sha256Hex } from "./crypto.ts";

export type MerchantApiAuth = {
  apiKeyId: string;
  merchantId: string;
  mode: "sandbox" | "live";
  scopes: string[];
};

function readApiKey(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return request.headers.get("x-api-key")?.trim() ?? null;
}

const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;

async function enforceRateLimit(
  supabase: any,
  apiKeyId: string
): Promise<void> {
  const limitFromEnv = Number(getEnv("API_RATE_LIMIT_PER_MINUTE"));
  const limit = Number.isFinite(limitFromEnv) && limitFromEnv > 0
    ? Math.floor(limitFromEnv)
    : DEFAULT_RATE_LIMIT_PER_MINUTE;

  // Bucket: floor current time to the minute
  const now = new Date();
  const window = new Date(now);
  window.setSeconds(0, 0);

  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_api_key_id: apiKeyId,
    p_window: window.toISOString()
  });

  if (error) {
    // Don't fail closed on a counter problem — just log and let the request through.
    console.error("rate_limit_hit failed:", error.message);
    return;
  }

  if (typeof data === "number" && data > limit) {
    throw new Response(
      JSON.stringify({
        error: {
          code: "rate_limited",
          message: `Rate limit exceeded (${limit} requests per minute).`
        }
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": "60",
          "x-ratelimit-limit": String(limit),
          "x-ratelimit-remaining": "0"
        }
      }
    );
  }
}

export async function requireApiKey(request: Request, supabase: any): Promise<MerchantApiAuth> {
  const apiKey = readApiKey(request);

  if (!apiKey) {
    throw new Response("Missing API key.", { status: 401 });
  }

  const keyHash = await sha256Hex(apiKey);
  const { data: keySecret, error: secretError } = await supabase
    .from("api_key_secrets")
    .select("api_key_id")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (secretError || !keySecret) {
    throw new Response("Invalid API key.", { status: 401 });
  }

  const { data: key, error: keyError } = await supabase
    .from("api_keys")
    .select("id, merchant_id, mode, scopes, revoked_at, expires_at")
    .eq("id", keySecret.api_key_id)
    .maybeSingle();

  if (keyError || !key || key.revoked_at) {
    throw new Response("Invalid API key.", { status: 401 });
  }

  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    throw new Response("Expired API key.", { status: 401 });
  }

  // Enforce per-key rate limit before touching the rest of the system
  await enforceRateLimit(supabase, key.id);

  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return {
    apiKeyId: key.id,
    merchantId: key.merchant_id,
    mode: key.mode,
    scopes: key.scopes ?? []
  };
}

export function requireInternalSecret(request: Request) {
  const configured = getEnv("INTERNAL_FUNCTION_SECRET");
  const provided = request.headers.get("x-internal-secret");

  if (!configured || !provided || provided !== configured) {
    throw new Response("Unauthorized.", { status: 401 });
  }
}

// Separate secret for the pg_cron → dispatch-webhooks call so the cron
// job can rotate independently of INTERNAL_FUNCTION_SECRET. Falls back to
// INTERNAL_FUNCTION_SECRET if DISPATCHER_SECRET is not set, so existing
// deployments keep working.
export function requireDispatcherSecret(request: Request) {
  const dispatcher = getEnv("DISPATCHER_SECRET");
  const internal = getEnv("INTERNAL_FUNCTION_SECRET");
  const provided = request.headers.get("x-internal-secret");

  if (!provided) {
    throw new Response("Unauthorized.", { status: 401 });
  }

  if (dispatcher && provided === dispatcher) return;
  if (internal && provided === internal) return;

  throw new Response("Unauthorized.", { status: 401 });
}

export function requireEmailSenderSecret(request: Request) {
  const emailSecret = getEnv("EMAIL_SENDER_SECRET");
  const dispatcher = getEnv("DISPATCHER_SECRET");
  const internal = getEnv("INTERNAL_FUNCTION_SECRET");
  const provided = request.headers.get("x-internal-secret");

  if (!provided) {
    throw new Response("Unauthorized.", { status: 401 });
  }

  if (emailSecret && provided === emailSecret) return;
  if (dispatcher && provided === dispatcher) return;
  if (internal && provided === internal) return;

  throw new Response("Unauthorized.", { status: 401 });
}

export async function authorizeInternalOrApiKey(request: Request, supabase: any) {
  const configured = getEnv("INTERNAL_FUNCTION_SECRET");
  const provided = request.headers.get("x-internal-secret");

  if (configured && provided === configured) {
    return { internal: true as const };
  }

  return {
    internal: false as const,
    apiKey: await requireApiKey(request, supabase)
  };
}
