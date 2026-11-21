import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canEditStory,
  canPublishRelease,
  canWriteStoryNotes,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { coordsFromGeo, geoJsonString, l10nEn } from "@/lib/geo";
import {
  ChecklistBadges,
  type ChecklistFailure,
} from "@/components/checklist-badges";
import {
  releaseBadgeKind,
  UnreleasedBadge,
} from "@/components/unreleased-badge";
import { UnpublishButton } from "@/components/unpublish-button";
import { GroveForm } from "../grove-form";
import { FragmentForm } from "../fragment-form";
import { PrereqGraph } from "../prereq-graph";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fragment?: string; new?: string }>;
};

export default async function GroveDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data: grove } = await supabase
    .from("groves")
    .select(
      "id, region_id, slug, name, premise, access_notes, website_url, gatherings_url, allows_speaker_wildlife_sounds, boundary_geojson, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (!grove) notFound();

  const { data: regions } = await supabase
    .from("regions")
    .select("id, name")
    .order("name");

  const { data: fragments } = await supabase
    .from("fragments")
    .select(
      "id, grove_id, title, teaser, tier, visibility, location_geojson, story_order, is_ending, trigger_radius_m, marker_code, indigeny_earth, indigeny_world, indigeny_body",
    )
    .eq("grove_id", id)
    .order("story_order");

  const { data: allFrags } = await supabase
    .from("fragments")
    .select("id, grove_id, title")
    .order("story_order");

  const fragIds = (fragments ?? []).map((f) => f.id as string);
  const { data: prereqGroups } = fragIds.length
    ? await supabase
        .from("fragment_prereq_groups")
        .select("id, fragment_id, sort_order")
        .in("fragment_id", fragIds)
        .order("sort_order")
    : { data: [] };

  const groupIds = (prereqGroups ?? []).map((g) => g.id as string);
  const { data: prereqMembers } = groupIds.length
    ? await supabase
        .from("fragment_prereq_members")
        .select("group_id, requires_fragment_id, sort_order")
        .in("group_id", groupIds)
        .order("sort_order")
    : { data: [] };

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name")
    .order("name");

  const { data: fragChars } = fragIds.length
    ? await supabase
        .from("fragment_characters")
        .select("fragment_id, character_id, prominence, introduces, card_line")
        .in("fragment_id", fragIds)
    : { data: [] };

  const { data: unreleased } = await supabase.rpc("fn_unreleased", {
    p_grove_id: id,
  });
  const unreleasedIds = new Set(
    ((unreleased ?? []) as { entity: string; entity_id: string }[]).map(
      (r) => r.entity_id,
    ),
  );
  const { data: groveSnaps } = await supabase
    .from("published_snapshots")
    .select("entity_id")
    .eq("entity", "grove")
    .eq("entity_id", id);
  const { data: fragSnaps } = fragIds.length
    ? await supabase
        .from("published_snapshots")
        .select("entity_id")
        .eq("entity", "fragment")
        .in("entity_id", fragIds)
    : { data: [] };
  const publishedIds = new Set([
    ...((groveSnaps ?? []).map((s) => s.entity_id as string)),
    ...((fragSnaps ?? []).map((s) => s.entity_id as string)),
  ]);

  let checklist: ChecklistFailure[] = [];
  {
    const { data: check } = await supabase.rpc("fn_draft_check", {
      p_grove_id: id,
    });
    const failures = (check as { failures?: ChecklistFailure[] } | null)
      ?.failures;
    if (Array.isArray(failures)) checklist = failures;
  }

  const canEdit = canEditStory(staff.role);
  const canNotes = canWriteStoryNotes(staff.role);
  const canUnpublish = canPublishRelease(staff.role);
  const addingNew = sp.new === "1" || sp.new === "true";
  const selectedId = addingNew ? undefined : (sp.fragment ?? fragIds[0]);
  const selected = selectedId
    ? (fragments ?? []).find((f) => f.id === selectedId)
    : undefined;

  const graphFragments = (
    (allFrags ?? []) as {
      id: string;
      grove_id: string;
      title: unknown;
    }[]
  ).map((f) => ({
    id: f.id,
    title: l10nEn(f.title) || f.id.slice(0, 8),
    groveId: f.grove_id,
    thisGrove: f.grove_id === id,
  }));

  const graphGroups = (prereqGroups ?? []).map((g) => ({
    fragmentId: g.fragment_id as string,
    members: (prereqMembers ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => m.requires_fragment_id as string),
  }));

  const selectedGroups = selected
    ? (prereqGroups ?? [])
        .filter((g) => g.fragment_id === selected.id)
        .map((g) => ({
          members: (prereqMembers ?? [])
            .filter((m) => m.group_id === g.id)
            .map((m) => m.requires_fragment_id as string),
        }))
    : [];

  const selectedLinks = selected
    ? (
        (fragChars ?? []) as {
          fragment_id: string;
          character_id: string;
          prominence: string;
          introduces: boolean;
          card_line: unknown;
        }[]
      )
        .filter((c) => c.fragment_id === selected.id)
        .map((c) => ({
          character_id: c.character_id,
          prominence: c.prominence,
          introduces: c.introduces,
          card_line_en: l10nEn(c.card_line),
        }))
    : [];

  return (
    <main className="px-8 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">
            {l10nEn(grove.name) || grove.slug}
          </h1>
          <p className="mt-2 text-textMuted">{grove.slug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UnreleasedBadge
            kind={releaseBadgeKind(grove.id, unreleasedIds, publishedIds)}
          />
          {canUnpublish && publishedIds.has(grove.id) ? (
            <UnpublishButton entity="grove" id={grove.id} />
          ) : null}
        </div>
      </div>

      {checklist.length ? (
        <div className="mt-4">
          <ChecklistBadges failures={checklist} />
        </div>
      ) : null}

      <section className="mt-8 max-w-xl">
        <h2 className="font-serif text-xl font-semibold">Grove</h2>
        <div className="mt-4">
          <GroveForm
            regions={(regions ?? []) as { id: string; name: string }[]}
            canEdit={canEdit}
            initial={{
              id: grove.id,
              region_id: grove.region_id,
              name_en: l10nEn(grove.name),
              premise_en: l10nEn(grove.premise),
              slug: grove.slug,
              access_notes: geoJsonString(grove.access_notes) || "{}",
              website_url: grove.website_url ?? "",
              gatherings_url: grove.gatherings_url ?? "",
              allows_speaker_wildlife_sounds:
                grove.allows_speaker_wildlife_sounds,
              boundaryJson: geoJsonString(grove.boundary_geojson),
            }}
          />
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-semibold">Fragments</h2>
          {canEdit ? (
            <Link
              href={`/story/groves/${id}?new=1`}
              className="text-sm text-primary underline"
            >
              New fragment
            </Link>
          ) : null}
        </div>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {((fragments ?? []) as { id: string; title: unknown; visibility: string }[]).map(
            (f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <Link
                  href={`/story/groves/${id}?fragment=${f.id}`}
                  className="text-primary hover:underline"
                  aria-current={f.id === selectedId ? "page" : undefined}
                >
                  {l10nEn(f.title) || f.id.slice(0, 8)}
                  {f.visibility === "physical" ? " · physical" : ""}
                </Link>
                <UnreleasedBadge
                  kind={releaseBadgeKind(f.id, unreleasedIds, publishedIds)}
                />
              </li>
            ),
          )}
          {(fragments ?? []).length === 0 ? (
            <li className="py-4 text-sm text-textMuted">No fragments yet.</li>
          ) : null}
        </ul>
      </section>

      {(fragments ?? []).length > 0 ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold">Graph</h2>
          <div className="mt-4">
            <PrereqGraph
              groveId={id}
              fragments={graphFragments}
              groups={graphGroups}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-12 max-w-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-semibold">
            {selected ? "Edit fragment" : "Add fragment"}
          </h2>
          {canUnpublish && selected && publishedIds.has(selected.id as string) ? (
            <UnpublishButton
              entity="fragment"
              id={selected.id as string}
            />
          ) : null}
        </div>
        <div className="mt-4">
          <FragmentForm
            groveId={id}
            canEdit={canEdit}
            canNotes={canNotes}
            allFragments={graphFragments.map((f) => ({
              id: f.id,
              title: f.title,
              grove_id: f.groveId,
            }))}
            characters={(characters ?? []) as { id: string; name: string }[]}
            prereqGroups={selectedGroups}
            characterLinks={selectedLinks}
            initial={
              selected
                ? (() => {
                    const loc = coordsFromGeo(selected.location_geojson);
                    return {
                      id: selected.id as string,
                      title_en: l10nEn(selected.title),
                      teaser_en: l10nEn(selected.teaser),
                      tier: selected.tier as string,
                      visibility: selected.visibility as string,
                      lat: loc?.lat ?? null,
                      lng: loc?.lng ?? null,
                      story_order: selected.story_order as number,
                      is_ending: selected.is_ending as boolean,
                      trigger_radius_m: selected.trigger_radius_m as number,
                      marker_code: (selected.marker_code as string | null) ?? null,
                      indigeny_earth: (selected.indigeny_earth as string) ?? "",
                      indigeny_world: (selected.indigeny_world as string) ?? "",
                      indigeny_body: (selected.indigeny_body as string) ?? "",
                    };
                  })()
                : canEdit
                  ? {
                      title_en: "",
                      teaser_en: "",
                      tier: "leaf",
                      visibility: "standard",
                      lat: null,
                      lng: null,
                      story_order: (fragments ?? []).length,
                      is_ending: false,
                      trigger_radius_m: 10.67,
                      marker_code: null,
                      indigeny_earth: "",
                      indigeny_world: "",
                      indigeny_body: "",
                    }
                  : undefined
            }
          />
        </div>
      </section>
    </main>
  );
}
