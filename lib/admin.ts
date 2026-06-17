import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserId } from "@/lib/auth";

export type AdminProfile = {
  userId: string;
  email: string | null;
  role: "super" | "support";
};

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  const userId = await requireUserId();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("app_admins")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) return null;

  const { data: userResult } = await admin.auth.admin.getUserById(userId);

  return {
    userId,
    email: userResult?.user?.email ?? null,
    role: row.role as "super" | "support"
  };
}

export async function requireAdmin(): Promise<AdminProfile> {
  const profile = await getCurrentAdmin();
  if (!profile) {
    redirect("/dashboard");
  }
  return profile;
}

export async function recordAudit(input: {
  actorUserId: string;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  notes?: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    target_table: input.targetTable ?? null,
    target_id: input.targetId ?? null,
    before_value: input.before ?? null,
    after_value: input.after ?? null,
    notes: input.notes ?? null
  });
}
