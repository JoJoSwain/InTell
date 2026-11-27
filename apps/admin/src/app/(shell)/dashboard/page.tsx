import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canPublishRelease, isActiveStaff, loadStaff } from "@/lib/staff";
import { redirect } from "next/navigation";
import { ExportArchiveButton } from "./export-button";

type Row = Record<string, string | number | null>;

const VIEWS = [
  {
    key: "visits",
    title: "Visits",
    caption: "Grove entries by month (America/Denver).",
    table: "v_dash_visits",
    barKey: "visit_count",
  },
  {
    key: "session_starts",
    title: "Session starts",
    caption: "session_started counts by month.",
    table: "v_dash_session_starts",
    barKey: "session_count",
  },
  {
    key: "fragments_completed",
    title: "Fragments completed",
    caption: "Completions per grove, tier, and time window.",
    table: "v_dash_fragments_completed",
    barKey: "completed_count",
  },
  {
    key: "depth",
    title: "Depth",
    caption: "Share of sessions with ≥1 branch and ≥1 leaf completed (n shown).",
    table: "v_dash_depth",
    barKey: null,
  },
  {
    key: "return_6mo",
    title: "Return (6 months)",
    caption: "Counts devices, not people.",
    table: "v_dash_return_6mo",
    barKey: "return_rate",
  },
  {
    key: "participation",
    title: "Participation",
    caption:
      "Journal by kind. % read within 14 days and median days to grown wait for M9.",
    table: "v_dash_participation",
    barKey: "entry_count",
  },
  {
    key: "contribution_return",
    title: "Contribution–return",
    caption: "Counts devices, not people. Not causal.",
    table: "v_dash_contribution_return",
    barKey: "contributor_return_rate",
  },
  {
    key: "checkins",
    title: "Check-ins",
    caption: "Self-reported, optional, not causal.",
    table: "v_dash_checkins",
    barKey: "response_rate",
  },
] as const;

function SimpleBar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className="h-2 w-full max-w-xs rounded bg-muted"
      role="img"
      aria-label={`Bar at ${pct} percent`}
    >
      <div
        className="h-2 rounded bg-primary"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function loadView(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
): Promise<{ rows: Row[]; error: string | null }> {
  const { data, error } = await supabase.from(table).select("*").limit(200);
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as Row[], error: null };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const sections = await Promise.all(
    VIEWS.map(async (v) => {
      const { rows, error } = await loadView(supabase, v.table);
      return { ...v, rows, error };
    }),
  );

  return (
    <main className="px-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-textMuted">
            Aggregate analytics only. Months use America/Denver. No device-level
            rows.
          </p>
        </div>
        {canPublishRelease(staff.role) ? <ExportArchiveButton /> : null}
      </div>

      <div className="mt-10 space-y-12">
        {sections.map((section) => {
          const barValues = section.barKey
            ? section.rows.map((r) => toNum(r[section.barKey!]))
            : [];
          const max = Math.max(0, ...barValues);
          const columns =
            section.rows[0] != null ? Object.keys(section.rows[0]) : [];

          return (
            <section key={section.key} aria-labelledby={`dash-${section.key}`}>
              <div>
                <h2
                  id={`dash-${section.key}`}
                  className="font-serif text-xl font-semibold"
                >
                  {section.title}
                </h2>
                <p className="mt-1 text-sm text-textMuted">{section.caption}</p>
                <Link
                  href={`/dashboard/csv/${section.key}`}
                  className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
                >
                  Download CSV
                </Link>
              </div>

              {section.error ? (
                <p className="mt-4 text-sm text-destructive" role="alert">
                  {section.error}
                </p>
              ) : section.rows.length === 0 ? (
                <p className="mt-4 text-sm text-textMuted">No rows yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-textMuted">
                        {columns.map((c) => (
                          <th key={c} className="px-2 py-2 font-medium">
                            {c}
                          </th>
                        ))}
                        {section.barKey ? (
                          <th className="px-2 py-2 font-medium"> </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/60 align-middle"
                        >
                          {columns.map((c) => (
                            <td key={c} className="px-2 py-2 tabular-nums">
                              {row[c] == null ? "—" : String(row[c])}
                            </td>
                          ))}
                          {section.barKey ? (
                            <td className="px-2 py-2">
                              <SimpleBar
                                value={toNum(row[section.barKey])}
                                max={
                                  section.barKey.endsWith("_rate")
                                    ? 1
                                    : max || 1
                                }
                              />
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
