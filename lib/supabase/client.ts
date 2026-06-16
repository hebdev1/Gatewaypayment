"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireCleanValue } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    requireCleanValue(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requireCleanValue(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    )
  );
}
