import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isActiveStaff, loadStaff } from "@/lib/staff";

const VIEW_TABLES: Record<string, string> = {
  visits: "v_dash_visits",
  session_starts: "v_dash_session_starts",
  fragments_completed: "v_dash_fragments_completed",
  depth: "v_dash_depth",
  return_6mo: "v_dash_return_6mo",
  participation: "v_dash_participation",
  contribution_return: "v_dash_contribution_return",
  checkins: "v_dash_checkins",
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    columns.join(","),
    ...rows.map((r) => columns.map((c) => escape(r[c])).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ view: string }> },
) {
  const { view } = await ctx.params;
  const table = VIEW_TABLES[view];
  if (!table) {
    return NextResponse.json({ error: "unknown view" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase.from(table).select("*").limit(5000);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = toCsv((data ?? []) as Record<string, unknown>[]);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dash-${view}.csv"`,
    },
  });
}
