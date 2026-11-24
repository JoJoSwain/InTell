import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canWriteRevisions,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { RevisionForm } from "../revision-form";

type Props = {
  params: Promise<{ id: string; fragmentId: string }>;
};

export default async function NewRevisionPage({ params }: Props) {
  const { id: groveId, fragmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canWriteRevisions(staff.role)) {
    redirect("/no-access");
  }

  const { data: fragment } = await supabase
    .from("fragments")
    .select("id, title, grove_id")
    .eq("id", fragmentId)
    .maybeSingle();
  if (!fragment || fragment.grove_id !== groveId) notFound();

  const { count } = await supabase
    .from("fragment_revisions")
    .select("id", { count: "exact", head: true })
    .eq("fragment_id", fragmentId);

  const { data: assets } = await supabase
    .from("audio_assets")
    .select("id, title, kind, staging_path")
    .order("title");

  const isFirst = (count ?? 0) === 0;
  const title = l10nEn(fragment.title as Record<string, string>);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-serif text-2xl font-semibold">
        {isFirst ? "First revision" : "New revision"} · {title}
      </h1>
      <RevisionForm
        groveId={groveId}
        fragmentId={fragmentId}
        isFirst={isFirst}
        canWrite
        audioAssets={(assets ?? []).map((a) => ({
          id: a.id as string,
          title: String(a.title ?? a.id),
          kind: String(a.kind),
          staging_path: (a.staging_path as string | null) ?? null,
        }))}
      />
    </div>
  );
}
