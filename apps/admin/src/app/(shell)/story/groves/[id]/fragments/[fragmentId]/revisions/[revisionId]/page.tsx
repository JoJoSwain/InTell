import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canPublishRelease,
  canWriteRevisions,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { StatusBadge } from "@/components/status-badge";
import { UnpublishButton } from "@/components/unpublish-button";
import { RevisionForm } from "../revision-form";
import { deleteDraftRevision } from "../actions";

type Props = {
  params: Promise<{ id: string; fragmentId: string; revisionId: string }>;
};

export default async function RevisionDetailPage({ params }: Props) {
  const { id: groveId, fragmentId, revisionId } = await params;
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

  const { data: revision } = await supabase
    .from("fragment_revisions")
    .select("id, revision_no, change_kind, status, change_note")
    .eq("id", revisionId)
    .eq("fragment_id", fragmentId)
    .maybeSingle();
  if (!revision) notFound();

  const { data: versions } = await supabase
    .from("revision_versions")
    .select("id, time_window, narration_asset_id, transcript, vtt")
    .eq("revision_id", revisionId);

  const { data: assets } = await supabase
    .from("audio_assets")
    .select("id, title, kind")
    .order("title");

  const day = (versions ?? []).find((v) => v.time_window === "day");
  const night = (versions ?? []).find((v) => v.time_window === "night");
  const isDraft = revision.status === "draft";
  const canWrite = canWriteRevisions(staff.role) && isDraft;
  const canUnpublish = canPublishRelease(staff.role) && !isDraft;
  const title = l10nEn(fragment.title as Record<string, string>);
  const isFirst = Number(revision.revision_no) === 1;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/story/groves/${groveId}/fragments/${fragmentId}/revisions`}
            className="underline-offset-4 hover:underline"
          >
            Revisions
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl font-semibold">
            Rev {revision.revision_no as number} · {title}
          </h1>
          <StatusBadge status={String(revision.status)} />
        </div>
      </div>

      <RevisionForm
        groveId={groveId}
        fragmentId={fragmentId}
        isFirst={isFirst}
        canWrite={canWrite}
        audioAssets={(assets ?? []).map((a) => ({
          id: a.id as string,
          title: String(a.title ?? a.id),
          kind: String(a.kind),
        }))}
        initial={{
          id: revision.id as string,
          revision_no: Number(revision.revision_no),
          change_kind: revision.change_kind as "contingency" | "correction",
          change_note: (revision.change_note as string) ?? "",
          status: String(revision.status),
          day: day
            ? {
                id: day.id as string,
                narration_asset_id: day.narration_asset_id as string,
                transcript: String(day.transcript ?? ""),
                vtt: String(day.vtt ?? ""),
              }
            : null,
          night: night
            ? {
                id: night.id as string,
                narration_asset_id: night.narration_asset_id as string,
                transcript: String(night.transcript ?? ""),
                vtt: String(night.vtt ?? ""),
              }
            : null,
        }}
      />

      <div className="flex flex-wrap gap-3">
        {isDraft && canWriteRevisions(staff.role) ? (
          <form action={deleteDraftRevision}>
            <input type="hidden" name="grove_id" value={groveId} />
            <input type="hidden" name="fragment_id" value={fragmentId} />
            <input type="hidden" name="revision_id" value={revisionId} />
            <button
              type="submit"
              className="text-sm text-destructive underline-offset-4 hover:underline"
              aria-label="Delete draft revision"
            >
              Delete draft
            </button>
          </form>
        ) : null}
        {canUnpublish ? (
          <UnpublishButton entity="revision" id={revisionId} />
        ) : null}
      </div>
    </div>
  );
}
