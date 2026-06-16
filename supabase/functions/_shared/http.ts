export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-internal-secret",
  "access-control-allow-methods": "GET, POST, OPTIONS"
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json"
    }
  });
}

export function errorResponse(message: string, status = 400, code = "bad_request") {
  return jsonResponse({ error: { code, message } }, status);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}
