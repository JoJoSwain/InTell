"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEFAULT_TRIGGER_RADIUS_M,
  feetToMetres,
  MAX_TRIGGER_RADIUS_FT,
  MIN_TRIGGER_RADIUS_FT,
} from "@intell/shared";
import { createClient } from "@/lib/supabase/server";
import {
  canEditStory,
  canWriteStoryNotes,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { generateMarkerCode } from "@/lib/markers/code";
import { asL10n } from "@/lib/geo";
import {
  type ActionAuthResult,
  saveHref,
  serverActionError,
} from "@/lib/server-action-result";

type GroveEditorContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  staff: Awaited<ReturnType<typeof loadStaff>>;
  userId: string;
};

type GroveNotesWriterContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  staff: Awaited<ReturnType<typeof loadStaff>>;
};

async function requireEditor(): Promise<ActionAuthResult<GroveEditorContext>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canEditStory(staff.role)) {
    return serverActionError("editor required");
  }
  return { ok: true, supabase, staff, userId: user.id };
}

async function requireEditorOrThrow(): Promise<GroveEditorContext> {
  const auth = await requireEditor();
  if (!auth.ok) throw new Error(auth.error);
  return auth;
}

async function requireNotesWriter(): Promise<
  ActionAuthResult<GroveNotesWriterContext>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canWriteStoryNotes(staff.role)) {
    return serverActionError("writer required");
  }
  return { ok: true, supabase, staff };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function saveGrove(formData: FormData) {
  const auth = await requireEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const id = String(formData.get("id") ?? "");
  const regionId = String(formData.get("region_id") ?? "");
  const nameEn = String(formData.get("name_en") ?? "").trim();
  const premiseEn = String(formData.get("premise_en") ?? "").trim();
  const websiteUrl = String(formData.get("website_url") ?? "").trim() || null;
  const gatheringsUrl =
    String(formData.get("gatherings_url") ?? "").trim() || null;
  const wildlife = formData.get("allows_speaker_wildlife_sounds") === "on";
  const slugInput = String(formData.get("slug") ?? "").trim();

  if (!regionId || !nameEn) return serverActionError("region and name required");

  const name = asL10n(nameEn);
  const premise = asL10n(premiseEn);
  const slug = slugInput || slugify(nameEn);

  if (id) {
    const { error } = await supabase
      .from("groves")
      .update({
        region_id: regionId,
        name,
        premise,
        website_url: websiteUrl,
        gatherings_url: gatheringsUrl,
        allows_speaker_wildlife_sounds: wildlife,
        slug,
      })
      .eq("id", id);
    if (error) return serverActionError(error.message);

    revalidatePath("/story/groves");
    revalidatePath(`/story/groves/${id}`);
    return { ok: true as const, href: saveHref(`/story/groves/${id}`) };
  }

  const { data, error } = await supabase
    .from("groves")
    .insert({
      region_id: regionId,
      name,
      premise,
      website_url: websiteUrl,
      gatherings_url: gatheringsUrl,
      allows_speaker_wildlife_sounds: wildlife,
      slug,
    })
    .select("id")
    .single();
  if (error) return serverActionError(error.message);
  const newId = data.id as string;

  revalidatePath("/story/groves");
  return { ok: true as const, href: saveHref(`/story/groves/${newId}`) };
}

export async function saveFragment(formData: FormData) {
  const auth = await requireEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const id = String(formData.get("id") ?? "");
  const groveId = String(formData.get("grove_id") ?? "");
  const titleEn = String(formData.get("title_en") ?? "").trim();
  const teaserEn = String(formData.get("teaser_en") ?? "").trim();
  const tier = String(formData.get("tier") ?? "leaf");
  const visibility = String(formData.get("visibility") ?? "standard");
  const latRaw = String(formData.get("lat") ?? "").trim();
  const lngRaw = String(formData.get("lng") ?? "").trim();
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const originalLatRaw = String(formData.get("original_lat") ?? "").trim();
  const originalLngRaw = String(formData.get("original_lng") ?? "").trim();
  const storyOrder = Number(formData.get("story_order") ?? 0);
  const isEnding = formData.get("is_ending") === "on";
  const radiusFt = Number(formData.get("radius_ft") ?? 35);
  let markerCode = String(formData.get("marker_code") ?? "").trim() || null;
  const indigenyEarth =
    String(formData.get("indigeny_earth") ?? "").trim() || null;
  const indigenyWorld =
    String(formData.get("indigeny_world") ?? "").trim() || null;
  const indigenyBody =
    String(formData.get("indigeny_body") ?? "").trim() || null;

  if (
    !groveId ||
    !titleEn ||
    !latRaw ||
    !lngRaw ||
    Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    return serverActionError("grove, title, lat and lng required");
  }

  if (visibility === "physical") {
    if (!markerCode) markerCode = generateMarkerCode();
  } else {
    // Non-physical fragments must not keep a leftover marker from a remounted form.
    markerCode = null;
  }

  let triggerRadiusM = DEFAULT_TRIGGER_RADIUS_M;
  if (visibility === "standard") {
    const ft = Math.min(
      MAX_TRIGGER_RADIUS_FT,
      Math.max(MIN_TRIGGER_RADIUS_FT, Number.isFinite(radiusFt) ? radiusFt : 35),
    );
    triggerRadiusM = feetToMetres(ft);
  }

  const title = asL10n(titleEn);
  const teaser = asL10n(teaserEn);
  // EWKT for PostgREST geography (GeoJSON objects fail parse); RPC sets canonical point.
  const locationEwkt = `SRID=4326;POINT(${lng} ${lat})`;
  const locationChanged =
    !id ||
    !originalLatRaw ||
    !originalLngRaw ||
    Math.abs(Number(originalLatRaw) - lat) > 1e-9 ||
    Math.abs(Number(originalLngRaw) - lng) > 1e-9;

  if (id) {
    const { error } = await supabase
      .from("fragments")
      .update({
        title,
        teaser,
        tier,
        visibility,
        story_order: storyOrder,
        is_ending: isEnding,
        trigger_radius_m: triggerRadiusM,
        marker_code: markerCode,
        indigeny_earth: indigenyEarth,
        indigeny_world: indigenyWorld,
        indigeny_body: indigenyBody,
      })
      .eq("id", id);
    if (error) return serverActionError(error.message);

    if (locationChanged) {
      const { error: locErr } = await supabase.rpc("fn_set_fragment_location", {
        p_fragment_id: id,
        p_lat: lat,
        p_lng: lng,
      });
      if (locErr) return serverActionError(locErr.message);
    }

    revalidatePath(`/story/groves/${groveId}`);
    return {
      ok: true as const,
      href: saveHref(`/story/groves/${groveId}?fragment=${id}`),
    };
  }

  const { data, error } = await supabase
    .from("fragments")
    .insert({
      grove_id: groveId,
      title,
      teaser,
      tier,
      visibility,
      story_order: storyOrder,
      is_ending: isEnding,
      trigger_radius_m: triggerRadiusM,
      marker_code: markerCode,
      location: locationEwkt,
      indigeny_earth: indigenyEarth,
      indigeny_world: indigenyWorld,
      indigeny_body: indigenyBody,
    })
    .select("id")
    .single();
  if (error) return serverActionError(error.message);
  const newId = data.id as string;

  const { error: locErr } = await supabase.rpc("fn_set_fragment_location", {
    p_fragment_id: newId,
    p_lat: lat,
    p_lng: lng,
  });
  if (locErr) return serverActionError(locErr.message);

  revalidatePath(`/story/groves/${groveId}`);
  return {
    ok: true as const,
    href: saveHref(`/story/groves/${groveId}?fragment=${newId}`),
  };
}

/** Writer path: Indigeny fields only (RLS + F1 guard). */
export async function saveFragmentIndigeny(formData: FormData) {
  const auth = await requireNotesWriter();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const id = String(formData.get("id") ?? "");
  const groveId = String(formData.get("grove_id") ?? "");
  if (!id) return serverActionError("id required");
  const { error } = await supabase
    .from("fragments")
    .update({
      indigeny_earth:
        String(formData.get("indigeny_earth") ?? "").trim() || null,
      indigeny_world:
        String(formData.get("indigeny_world") ?? "").trim() || null,
      indigeny_body: String(formData.get("indigeny_body") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) return serverActionError(error.message);
  revalidatePath(`/story/groves/${groveId}`);
  return {
    ok: true as const,
    href: saveHref(`/story/groves/${groveId}?fragment=${id}`),
  };
}

export async function rotateMarkerCode(formData: FormData) {
  const { supabase } = await requireEditorOrThrow();
  const id = String(formData.get("id") ?? "");
  const groveId = String(formData.get("grove_id") ?? "");
  if (!id) throw new Error("id required");
  const code = generateMarkerCode();
  const { error } = await supabase
    .from("fragments")
    .update({ marker_code: code, visibility: "physical" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/story/groves/${groveId}`);
  revalidatePath(`/print/marker/${id}`);
  redirect(`/story/groves/${groveId}?fragment=${id}`);
}

export async function savePrereqGroups(formData: FormData) {
  const { supabase } = await requireEditorOrThrow();
  const fragmentId = String(formData.get("fragment_id") ?? "");
  const groveId = String(formData.get("grove_id") ?? "");
  const payloadRaw = String(formData.get("prereq_json") ?? "[]");
  if (!fragmentId) throw new Error("fragment required");

  let groups: { members: string[] }[];
  try {
    groups = JSON.parse(payloadRaw) as { members: string[] }[];
  } catch {
    throw new Error("prereq_json must be JSON");
  }

  const { data: existing } = await supabase
    .from("fragment_prereq_groups")
    .select("id")
    .eq("fragment_id", fragmentId);
  const existingIds = (existing ?? []).map((g) => g.id as string);
  if (existingIds.length) {
    await supabase
      .from("fragment_prereq_members")
      .delete()
      .in("group_id", existingIds);
    await supabase
      .from("fragment_prereq_groups")
      .delete()
      .eq("fragment_id", fragmentId);
  }

  for (let i = 0; i < groups.length; i++) {
    const members = groups[i]?.members ?? [];
    if (!members.length) continue;
    const { data: grp, error } = await supabase
      .from("fragment_prereq_groups")
      .insert({ fragment_id: fragmentId, sort_order: i })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const rows = members.map((requires_fragment_id, j) => ({
      group_id: grp.id as string,
      requires_fragment_id,
      sort_order: j,
    }));
    const { error: mErr } = await supabase
      .from("fragment_prereq_members")
      .insert(rows);
    if (mErr) throw new Error(mErr.message);
  }

  revalidatePath(`/story/groves/${groveId}`);
  redirect(`/story/groves/${groveId}?fragment=${fragmentId}`);
}

export async function saveFragmentCharacters(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canWriteStoryNotes(staff.role)) {
    throw new Error("writer required");
  }

  const fragmentId = String(formData.get("fragment_id") ?? "");
  const groveId = String(formData.get("grove_id") ?? "");
  const payloadRaw = String(formData.get("characters_json") ?? "[]");
  let links: {
    character_id: string;
    prominence: string;
    introduces: boolean;
    card_line_en: string;
  }[];
  try {
    links = JSON.parse(payloadRaw) as typeof links;
  } catch {
    throw new Error("characters_json must be JSON");
  }

  await supabase
    .from("fragment_characters")
    .delete()
    .eq("fragment_id", fragmentId);

  if (links.length) {
    const { error } = await supabase.from("fragment_characters").insert(
      links.map((l) => ({
        fragment_id: fragmentId,
        character_id: l.character_id,
        prominence: l.prominence,
        introduces: l.introduces,
        card_line: asL10n(l.card_line_en || ""),
      })),
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/story/groves/${groveId}`);
  redirect(`/story/groves/${groveId}?fragment=${fragmentId}`);
}

const JOURNEY_MODES = ["walk", "bike", "transit"] as const;

/** Writer+ may upsert grove journey passages (ADR 0005 / M3e). */
export async function saveGroveJourneys(formData: FormData) {
  const auth = await requireNotesWriter();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const groveId = String(formData.get("grove_id") ?? "");
  if (!groveId) return serverActionError("grove required");

  for (const mode of JOURNEY_MODES) {
    const text = String(formData.get(`journey_${mode}`) ?? "").trim();
    if (!text) {
      const { error } = await supabase
        .from("grove_journeys")
        .delete()
        .eq("grove_id", groveId)
        .eq("mode", mode);
      if (error) return serverActionError(error.message);
      continue;
    }
    const { error } = await supabase.from("grove_journeys").upsert(
      {
        grove_id: groveId,
        mode,
        passage: asL10n(text),
      },
      { onConflict: "grove_id,mode" },
    );
    if (error) return serverActionError(error.message);
  }

  revalidatePath(`/story/groves/${groveId}`);
  return {
    ok: true as const,
    href: saveHref(`/story/groves/${groveId}?journeys=${Date.now()}`),
  };
}
