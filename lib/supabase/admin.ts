import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cleanEnvValue, requireEnv } from "@/lib/env";

export function createAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY) ?? requireEnv("SUPABASE_SECRET_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
