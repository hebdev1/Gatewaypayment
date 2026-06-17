import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type MerchantRow = {
  id: string;
  display_name: string;
  legal_name: string | null;
  email: string | null;
  status: string;
  live_enabled: boolean;
  default_currency: string;
  created_at: string;
};

const PAGE_SIZE = 25;

export default async function AdminMerchantsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const status = params.status ?? "";
  const search = (params.q ?? "").trim();

  const admin = createAdminClient();
  let query = admin
    .from("merchants")
    .select(
      "id, display_name, legal_name, email, status, live_enabled, default_currency, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("display_name", `%${search}%`);

  const { data, count } = await query;
  const merchants = (data ?? []) as MerchantRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Tenants</p>
          <h1>Merchants</h1>
        </div>
      </header>

      <section className="data-card">
        <form className="filter-row" method="get">
          <div className="field">
            <label htmlFor="q">Display name</label>
            <input
              className="input"
              id="q"
              name="q"
              type="search"
              defaultValue={search}
              placeholder="Search"
            />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue={status}>
              <option value="">Any</option>
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </select>
          </div>
          <div className="field">
            <button className="button" type="submit">
              Apply
            </button>
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Legal</th>
                <th>Email</th>
                <th>Status</th>
                <th>Live</th>
                <th>Currency</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((merchant) => (
                <tr key={merchant.id}>
                  <td>{merchant.display_name}</td>
                  <td>{merchant.legal_name ?? "—"}</td>
                  <td>{merchant.email ?? "—"}</td>
                  <td>
                    <span className={`status-pill ${merchant.status}`}>{merchant.status}</span>
                  </td>
                  <td>{merchant.live_enabled ? "yes" : "no"}</td>
                  <td>{merchant.default_currency}</td>
                  <td>{new Date(merchant.created_at).toLocaleString()}</td>
                  <td>
                    <Link className="mono" href={`/admin/merchants/${merchant.id}`}>
                      details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!merchants.length ? <p className="empty">No merchants match.</p> : null}
        </div>

        <div className="pager">
          <span>
            Page {page} of {totalPages} — {totalCount} total
          </span>
        </div>
      </section>
    </>
  );
}
