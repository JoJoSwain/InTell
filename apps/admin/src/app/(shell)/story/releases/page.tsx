import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canPublishRelease, isActiveStaff, loadStaff } from "@/lib/staff";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

type ReleaseRow = {
  id: string;
  name: string;
  status: string;
  publish_at: string | null;
  published_at: string | null;
  created_at: string;
};

export default async function ReleasesListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  // Order: publish_at, then created_at (review answer 22).
  const { data: releases, error } = await supabase
    .from("releases")
    .select("id, name, status, publish_at, published_at, created_at")
    .order("publish_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const editable = canPublishRelease(staff.role);

  return (
    <main className="px-8 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Releases</h1>
          <p className="mt-2 text-textMuted">
            Checklist, schedule, publish and history.
          </p>
        </div>
        {editable ? (
          <Button asChild>
            <Link href="/story/releases/new">New release</Link>
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {((releases ?? []) as ReleaseRow[]).map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div>
              <Link
                href={`/story/releases/${r.id}`}
                className="font-medium text-primary hover:underline"
              >
                {r.name}
              </Link>
              <p className="text-sm text-textMuted">
                {r.publish_at
                  ? `Scheduled ${new Date(r.publish_at).toLocaleString()}`
                  : r.published_at
                    ? `Published ${new Date(r.published_at).toLocaleString()}`
                    : `Created ${new Date(r.created_at).toLocaleString()}`}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </li>
        ))}
        {(releases ?? []).length === 0 ? (
          <li className="py-6 text-sm text-textMuted">No releases yet.</li>
        ) : null}
      </ul>
    </main>
  );
}
