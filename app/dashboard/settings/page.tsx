import { Building2, KeyRound, LogOut, Users } from "lucide-react";
import { requireMerchant, requireUserId } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  addTeamMemberAction,
  removeTeamMemberAction,
  updateBusinessProfileAction,
  updatePasswordAction,
  signOutEverywhereAction
} from "./actions";

type Member = {
  user_id: string;
  role: string;
  created_at: string;
  email: string;
};

const ROLES = ["owner", "admin", "developer", "viewer"] as const;

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{
    profile?: string;
    password?: string;
    team?: string;
    error?: string;
  }>;
}) {
  const userId = await requireUserId();
  const { merchant } = await requireMerchant();
  const params = await searchParams;

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: fullMerchant }, { data: rawMembers }, { data: userResult }] = await Promise.all([
    supabase
      .from("merchants")
      .select("id, display_name, legal_name, email, phone, country_code, default_currency, status, live_enabled")
      .eq("id", merchant.id)
      .single(),
    admin
      .from("merchant_members")
      .select("user_id, role, created_at")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: true }),
    admin.auth.admin.getUserById(userId)
  ]);

  // Enrich members with emails (best-effort via admin API)
  const members: Member[] = [];
  for (const m of rawMembers ?? []) {
    const { data } = await admin.auth.admin.getUserById(m.user_id);
    members.push({
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      email: data?.user?.email ?? "—"
    });
  }

  const currentEmail = userResult?.user?.email ?? "—";
  const myMembership = members.find((m) => m.user_id === userId);
  const isOwner = myMembership?.role === "owner";

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Settings</h1>
          <p>Signed in as <strong>{currentEmail}</strong> · merchant <strong>{merchant.display_name}</strong></p>
        </div>
      </header>

      {params.error ? <p className="error">{params.error}</p> : null}

      <section className="data-card">
        <div className="data-card-header">
          <h2><Building2 size={16} aria-hidden="true" /> Business profile</h2>
        </div>
        <form action={updateBusinessProfileAction} className="stack" style={{ padding: 16 }}>
          {params.profile ? <p className="notice">Profile saved.</p> : null}
          <div className="split-grid">
            <div className="field">
              <label htmlFor="display_name">Display name</label>
              <input
                className="input"
                id="display_name"
                name="display_name"
                defaultValue={fullMerchant?.display_name ?? ""}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="legal_name">Legal name</label>
              <input
                className="input"
                id="legal_name"
                name="legal_name"
                defaultValue={fullMerchant?.legal_name ?? ""}
              />
            </div>
          </div>
          <div className="split-grid">
            <div className="field">
              <label htmlFor="email">Business email</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                defaultValue={fullMerchant?.email ?? ""}
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Business phone</label>
              <input
                className="input"
                id="phone"
                name="phone"
                defaultValue={fullMerchant?.phone ?? ""}
              />
            </div>
          </div>
          <div className="split-grid">
            <div className="field">
              <label htmlFor="country_code">Country (ISO-2)</label>
              <input
                className="input"
                id="country_code"
                name="country_code"
                maxLength={2}
                pattern="[A-Z]{2}"
                defaultValue={fullMerchant?.country_code ?? "HT"}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="default_currency">Default currency (ISO-3)</label>
              <input
                className="input"
                id="default_currency"
                name="default_currency"
                maxLength={3}
                pattern="[A-Z]{3}"
                defaultValue={fullMerchant?.default_currency ?? "HTG"}
                required
              />
            </div>
          </div>
          <div className="row-actions">
            <button className="button" type="submit">Save profile</button>
          </div>
        </form>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2><KeyRound size={16} aria-hidden="true" /> Change password</h2>
        </div>
        <form action={updatePasswordAction} className="stack" style={{ padding: 16, maxWidth: 480 }}>
          {params.password ? <p className="notice">Password updated.</p> : null}
          <div className="field">
            <label htmlFor="current_password">Current password</label>
            <input
              className="input"
              id="current_password"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label htmlFor="new_password">New password (min 8 chars)</label>
            <input
              className="input"
              id="new_password"
              name="new_password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="confirm_password">Confirm new password</label>
            <input
              className="input"
              id="confirm_password"
              name="confirm_password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="row-actions">
            <button className="button" type="submit">Update password</button>
          </div>
        </form>
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2><Users size={16} aria-hidden="true" /> Team</h2>
          <span className="status-pill">{members.length} member{members.length === 1 ? "" : "s"}</span>
        </div>

        {params.team ? <p className="notice" style={{ margin: 16 }}>Team updated.</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.user_id}>
                  <td>{member.email}</td>
                  <td>
                    <span className="mode-pill">{member.role}</span>
                  </td>
                  <td>{new Date(member.created_at).toLocaleString()}</td>
                  <td>
                    {isOwner && member.user_id !== userId && member.role !== "owner" ? (
                      <form action={removeTeamMemberAction}>
                        <input type="hidden" name="user_id" value={member.user_id} />
                        <button className="button secondary" type="submit">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isOwner ? (
          <form action={addTeamMemberAction} className="stack" style={{ padding: 16 }}>
            <h3>Add a team member</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: -8 }}>
              The user must already have a HaitiPay account (signed up at /register).
            </p>
            <div className="split-grid">
              <div className="field">
                <label htmlFor="member_email">Email</label>
                <input
                  className="input"
                  id="member_email"
                  name="email"
                  type="email"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="member_role">Role</label>
                <select
                  className="input"
                  id="member_role"
                  name="role"
                  defaultValue="developer"
                >
                  {ROLES.filter((r) => r !== "owner").map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row-actions">
              <button className="button" type="submit">Add member</button>
            </div>
          </form>
        ) : (
          <p className="empty" style={{ padding: 16 }}>
            Only the merchant owner can add or remove team members.
          </p>
        )}
      </section>

      <section className="data-card">
        <div className="data-card-header">
          <h2><LogOut size={16} aria-hidden="true" /> Sessions</h2>
        </div>
        <div style={{ padding: 16 }}>
          <p>
            Sign out of every device you&apos;re currently logged in to. You&apos;ll need
            to enter your password again on each one.
          </p>
          <form action={signOutEverywhereAction}>
            <button className="button secondary" type="submit">
              Sign out of all sessions
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
