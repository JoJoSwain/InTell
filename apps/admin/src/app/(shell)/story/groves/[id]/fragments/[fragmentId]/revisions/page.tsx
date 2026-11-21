import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canWriteRevisions,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { StatusBadge } from "@/components/status-badge";
import { l10nEn } from "@/lib/geo";

type Props = {
  params: Promise<{ id: string; fragmentId: string }>;
};

export default async function RevisionsListPage({ params }: Props) {
  const { id: groveId, fragmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data: fragment } = await supabase
    .from("fragments")
    .select("id, title, grove_id")
    .eq("id", fragmentId)
    .maybeSingle();
  if (!fragment || fragment.grove_id !== groveId) notFound();

  const { data: revisions } = await supabase
    .from("fragment_revisions")
    .select("id, revision_no, change_kind, status, change_note, updated_at")
    .eq("fragment_id", fragmentId)
    .order("revision_no", { ascending: true });

  const canWrite = canWriteRevisions(staff.role);
  const title = l10nEn(fragment.title as Record<string, string>);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/story/groves/${groveId}`} className="underline-offset-4 hover:underline">
            Grove
          </Link>
          {" · "}
          Fragment
        </p>
        <h1 className="mt-1 font-serif text-2xl font-semibold">
          Revisions · {title}
        </h1>
      </div>

      {canWrite ? (
        <Link
          href={`/story/groves/${groveId}/fragments/${fragmentId}/revisions/new`}
          className="inline-flex rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          {(revisions ?? []).length === 0
            ? "Add first revision"
            : "Add revision"}
        </Link>
      ) : null}

      <ul className="divide-y divide-border rounded-md border border-border" aria-label="Revisions">
        {(revisions ?? []).length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            No revisions yet.
          </li>
        ) : (
          (revisions ?? []).map((r) => (
            <li key={r.id as string}>
              <Link
                href={`/story/groves/${groveId}/fragments/${fragmentId}/revisions/${r.id}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <span className="font-medium">Rev {r.revision_no as number}</span>
                <StatusBadge status={String(r.status)} />
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                  {r.change_kind === "contingency"
                    ? "Story Contingency"
                    : "Story Correction"}
                </span>
                {r.change_note ? (
                  <span className="text-sm text-muted-foreground truncate max-w-md">
                    {String(r.change_note)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
