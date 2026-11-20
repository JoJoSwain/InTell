import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canViewAudit, isActiveStaff, loadStaff } from "@/lib/staff";

type AuditRow = {
  id: number;
  created_at: string;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
};

type Props = {
  searchParams: Promise<{ action?: string; entity?: string }>;
};

export default async function AuditPage({ searchParams }: Props) {
  const filters = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewAudit(staff.role)) {
    redirect("/");
  }

  let query = supabase
    .from("audit_log")
    .select("id, created_at, actor, action, entity, entity_id, detail")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.action?.trim()) {
    query = query.ilike("action", `%${filters.action.trim()}%`);
  }
  if (filters.entity?.trim()) {
    query = query.eq("entity", filters.entity.trim());
  }

  const { data: rows, error } = await query;

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">Audit log</h1>
      <p className="mt-2 text-textMuted">
        Read-only. Editor and admin only (RLS).
      </p>

      <form method="get" className="mt-6 flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="text-textMuted">Action contains</span>
          <input
            name="action"
            defaultValue={filters.action ?? ""}
            className="ml-2 rounded-md border border-input bg-background px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="text-textMuted">Entity</span>
          <input
            name="entity"
            defaultValue={filters.entity ?? ""}
            className="ml-2 rounded-md border border-input bg-background px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted"
        >
          Filter
        </button>
      </form>

      {error ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-textMuted">
              <th className="py-2 pr-3 font-medium">When</th>
              <th className="py-2 pr-3 font-medium">Action</th>
              <th className="py-2 pr-3 font-medium">Entity</th>
              <th className="py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {((rows ?? []) as AuditRow[]).map((row) => (
              <tr key={row.id} className="border-b border-border/60 align-top">
                <td className="py-2 pr-3 whitespace-nowrap text-textMuted">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="py-2 pr-3 font-medium">{row.action}</td>
                <td className="py-2 pr-3">
                  {row.entity}
                  {row.entity_id ? (
                    <span className="block font-mono text-xs text-textMuted">
                      {row.entity_id.slice(0, 8)}…
                    </span>
                  ) : null}
                </td>
                <td className="py-2 font-mono text-xs text-textMuted">
                  {row.detail ? JSON.stringify(row.detail) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(rows ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-textMuted">No audit rows match.</p>
        ) : null}
      </div>
    </main>
  );
}
