import { getEnv } from "./env.ts";

// Allow-list via CORS_ALLOWED_ORIGINS (comma-separated). Defaults to "*"
// because most callers are server-to-server merchant integrations that
// don't go through a browser, but you can lock it down to your dashboard
// origin for stricter deployments.
function allowedOrigin(request: Request | undefined): string {
  const configured = getEnv("CORS_ALLOWED_ORIGINS");
  if (!configured) return "*";

  const origin = request?.headers.get("origin");
  if (!origin) return configured.split(",")[0]?.trim() ?? "*";

  const list = configured.split(",").map((o) => o.trim()).filter(Boolean);
  return list.includes(origin) ? origin : list[0] ?? "*";
}

export function buildCorsHeaders(request?: Request) {
  return {
    "access-control-allow-origin": allowedOrigin(request),
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type, x-api-key, x-internal-secret",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "vary": "Origin"
  };
}

// Backwards-compatible: callers without a Request fall back to "*"
export const corsHeaders = buildCorsHeaders();

export function jsonResponse(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(request),
      "content-type": "application/json"
    }
  });
}

export function errorResponse(
  message: string,
  status = 400,
  code = "bad_request",
  request?: Request
) {
  return jsonResponse({ error: { code, message } }, status, request);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}
