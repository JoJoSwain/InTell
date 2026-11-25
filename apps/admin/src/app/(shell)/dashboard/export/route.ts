import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canPublishRelease, isActiveStaff, loadStaff } from "@/lib/staff";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!user || !session?.access_token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canPublishRelease(staff.role)) {
    return NextResponse.json({ error: "editor required" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const res = await fetch(`${base}/functions/v1/export-archive`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return NextResponse.json(
      { error: json.error ?? `export-archive ${res.status}` },
      { status: res.status },
    );
  }

  const bytes = await res.arrayBuffer();
  const disposition =
    res.headers.get("Content-Disposition") ??
    'attachment; filename="intell-archive.zip"';
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": disposition,
    },
  });
}
