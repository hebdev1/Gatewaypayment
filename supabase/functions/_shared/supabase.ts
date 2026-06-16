import { createClient } from "https://esm.sh/@supabase/supabase-js@2.102.0";
import { getEnv } from "./env.ts";

export function adminClient() {
  const url = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SUPABASE_SECRET_KEY");

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service environment variables.");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
