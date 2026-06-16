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
  const configured = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const provided = request.headers.get("x-internal-secret");

  if (!configured || !provided || provided !== configured) {
    throw new Response("Unauthorized.", { status: 401 });
  }
}

export async function authorizeInternalOrApiKey(request: Request, supabase: any) {
  const configured = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const provided = request.headers.get("x-internal-secret");

  if (configured && provided === configured) {
    return { internal: true as const };
  }

  return {
    internal: false as const,
    apiKey: await requireApiKey(request, supabase)
  };
}
