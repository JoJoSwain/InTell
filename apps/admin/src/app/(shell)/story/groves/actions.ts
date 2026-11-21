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

async function requireEditor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canEditStory(staff.role)) {
    throw new Error("editor required");
  }
  return { supabase, staff, userId: user.id };
}

async function requireNotesWriter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canWriteStoryNotes(staff.role)) {
    throw new Error("writer required");
  }
  return { supabase, staff };
}

function parseAccessNotes(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    throw new Error("access notes must be JSON object");
  }
  throw new Error("access notes must be JSON object");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function saveGrove(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "");
  const regionId = String(formData.get("region_id") ?? "");
  const nameEn = String(formData.get("name_en") ?? "").trim();
  const premiseEn = String(formData.get("premise_en") ?? "").trim();
  const accessRaw = String(formData.get("access_notes") ?? "");
  const websiteUrl = String(formData.get("website_url") ?? "").trim() || null;
  const gatheringsUrl =
    String(formData.get("gatherings_url") ?? "").trim() || null;
  const wildlife = formData.get("allows_speaker_wildlife_sounds") === "on";
  const boundaryGeoJson = String(formData.get("boundary") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();

  if (!regionId || !nameEn) throw new Error("region and name required");
  if (!boundaryGeoJson) throw new Error("boundary GeoJSON required");

  let geo: { type?: string; coordinates?: unknown };
  try {
    geo = JSON.parse(boundaryGeoJson) as {
      type?: string;
      coordinates?: unknown;
    };
  } catch {
    throw new Error("boundary must be valid GeoJSON");
  }
  if (geo.type !== "Polygon" || !Array.isArray(geo.coordinates)) {
    throw new Error("boundary must be a GeoJSON Polygon");
  }

  const accessNotes = parseAccessNotes(accessRaw);
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
        access_notes: accessNotes,
        website_url: websiteUrl,
        gatherings_url: gatheringsUrl,
        allows_speaker_wildlife_sounds: wildlife,
        slug,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    const { error: bErr } = await supabase.rpc("fn_set_grove_boundary", {
      p_grove_id: id,
      p_geojson: JSON.stringify(geo),
    });
    if (bErr) throw new Error(bErr.message);

    revalidatePath("/story/groves");
    revalidatePath(`/story/groves/${id}`);
    redirect(`/story/groves/${id}`);
  }

  // Placeholder EWKT so NOT NULL boundary is satisfied; real shape via invoker RPC.
  const placeholder =
    "SRID=4326;POLYGON((-180 -85,-180 85,180 85,180 -85,-180 -85))";
  const { data, error } = await supabase
    .from("groves")
    .insert({
      region_id: regionId,
      name,
      premise,
      access_notes: accessNotes,
      website_url: websiteUrl,
      gatherings_url: gatheringsUrl,
      allows_speaker_wildlife_sounds: wildlife,
      slug,
      boundary: placeholder,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const newId = data.id as string;

  const { error: bErr } = await supabase.rpc("fn_set_grove_boundary", {
    p_grove_id: newId,
    p_geojson: JSON.stringify(geo),
  });
  if (bErr) throw new Error(bErr.message);

  revalidatePath("/story/groves");
  redirect(`/story/groves/${newId}`);
}

export async function saveFragment(formData: FormData) {
  const { supabase, staff } = await requireEditor().catch(async (err) => {
    // Writers may update Indigeny only — handled by saveFragmentIndigeny
    throw err;
  });
  void staff;

  const id = String(formData.get("id") ?? "");
  const groveId = String(formData.get("grove_id") ?? "");
  const titleEn = String(formData.get("title_en") ?? "").trim();
  const teaserEn = String(formData.get("teaser_en") ?? "").trim();
  const tier = String(formData.get("tier") ?? "leaf");
  const visibility = String(formData.get("visibility") ?? "standard");
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
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

  if (!groveId || !titleEn || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error("grove, title, lat and lng required");
  }

  if (visibility === "physical") {
    if (!markerCode) markerCode = generateMarkerCode();
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
    if (error) throw new Error(error.message);

    const { error: locErr } = await supabase.rpc("fn_set_fragment_location", {
      p_fragment_id: id,
      p_lat: lat,
      p_lng: lng,
    });
    if (locErr) throw new Error(locErr.message);

    revalidatePath(`/story/groves/${groveId}`);
    redirect(`/story/groves/${groveId}?fragment=${id}`);
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
  if (error) throw new Error(error.message);
  const newId = data.id as string;

  const { error: locErr } = await supabase.rpc("fn_set_fragment_location", {
    p_fragment_id: newId,
    p_lat: lat,
    p_lng: lng,
  });
  if (locErr) throw new Error(locErr.message);

  revalidatePath(`/story/groves/${groveId}`);
  redirect(`/story/groves/${groveId}?fragment=${newId}`);
}

/** Writer path: Indigeny fields only (RLS + F1 guard). */
export async function saveFragmentIndigeny(formData: FormData) {
  const { supabase } = await requireNotesWriter();
  const id = String(formData.get("id") ?? "");
  const groveId = String(formData.get("grove_id") ?? "");
  if (!id) throw new Error("id required");
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
  if (error) throw new Error(error.message);
  revalidatePath(`/story/groves/${groveId}`);
  redirect(`/story/groves/${groveId}?fragment=${id}`);
}

export async function rotateMarkerCode(formData: FormData) {
  const { supabase } = await requireEditor();
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
  const { supabase } = await requireEditor();
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
