"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MusicCondition } from "@intell/shared";
import { createClient } from "@/lib/supabase/server";
import {
  canEditSound,
  isActiveStaff,
  loadStaff,
  type StaffRow,
} from "@/lib/staff";
import {
  type ActionAuthResult,
  type ServerActionResult,
  saveHref,
  serverActionError,
} from "@/lib/server-action-result";
import {
  parseCommaSeparatedInts,
  parseMusicConditionJson,
  parsePolygonGeoJson,
  stemsOverMaxMessage,
} from "@/lib/sound/helpers";

type SoundAuth = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  staff: StaffRow;
};

async function requireSoundEditor(): Promise<ActionAuthResult<SoundAuth>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canEditSound(staff.role)) {
    return serverActionError("sound, editor or admin required");
  }
  return { ok: true, supabase, staff };
}

export async function saveAmbienceProfile(formData: FormData): Promise<ServerActionResult> {
  const auth = await requireSoundEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const id = String(formData.get("id") ?? "");
  const density = Number(formData.get("density") ?? 1);
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!id) return serverActionError("id required");
  if (!Number.isFinite(density) || density < 0) {
    return serverActionError("density must be a non-negative number");
  }
  const { error } = await supabase
    .from("ambience_profiles")
    .update({ density, description })
    .eq("id", id);
  if (error) return serverActionError(error.message);
  revalidatePath("/sound/profiles");
  revalidatePath(`/sound/profiles/${id}`);
  return { ok: true, href: saveHref(`/sound/profiles/${id}`) };
}

export async function saveAmbienceLayer(formData: FormData): Promise<ServerActionResult> {
  const auth = await requireSoundEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const id = String(formData.get("id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");
  if (!id || !profileId) return serverActionError("layer id and profile required");

  const monthsRaw = String(formData.get("months") ?? "").trim();
  const nestingRaw = String(formData.get("nesting_mute_months") ?? "").trim();
  let months: number[];
  let nesting_mute_months: number[];
  try {
    months = parseCommaSeparatedInts(monthsRaw);
    nesting_mute_months = parseCommaSeparatedInts(nestingRaw);
  } catch (e) {
    return serverActionError(e instanceof Error ? e.message : "invalid months");
  }

  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    kind: String(formData.get("kind") ?? "oneshot"),
    gain_db_min: Number(formData.get("gain_db_min") ?? 0),
    gain_db_max: Number(formData.get("gain_db_max") ?? 0),
    pan_min: Number(formData.get("pan_min") ?? -1),
    pan_max: Number(formData.get("pan_max") ?? 1),
    pitch_cents_min: Number(formData.get("pitch_cents_min") ?? 0),
    pitch_cents_max: Number(formData.get("pitch_cents_max") ?? 0),
    min_interval_s:
      String(formData.get("min_interval_s") ?? "").trim() === ""
        ? null
        : Number(formData.get("min_interval_s")),
    mean_interval_s:
      String(formData.get("mean_interval_s") ?? "").trim() === ""
        ? null
        : Number(formData.get("mean_interval_s")),
    max_concurrent: Number(formData.get("max_concurrent") ?? 1),
    crossfade_ms: Number(formData.get("crossfade_ms") ?? 4000),
    no_repeat_last: Number(formData.get("no_repeat_last") ?? 0),
    speaker_safe: formData.get("speaker_safe") === "on",
    wildlife_call: formData.get("wildlife_call") === "on",
    months,
    nesting_mute_months,
  };

  if (!payload.name) return serverActionError("name required");

  const { error } = await supabase
    .from("ambience_layers")
    .update(payload)
    .eq("id", id);
  if (error) return serverActionError(error.message);

  revalidatePath(`/sound/profiles/${profileId}`);
  revalidatePath(`/sound/profiles/${profileId}/layers/${id}`);
  return { ok: true, href: saveHref(`/sound/profiles/${profileId}/layers/${id}`) };
}

export async function saveLayerAssetWeights(
  formData: FormData,
): Promise<ServerActionResult> {
  const auth = await requireSoundEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const layerId = String(formData.get("layer_id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");
  if (!layerId || !profileId) return serverActionError("layer required");

  const assetIds = formData.getAll("asset_id").map((v) => String(v));
  const weights = formData.getAll("weight").map((v) => Number(v));

  await supabase.from("ambience_layer_assets").delete().eq("layer_id", layerId);

  for (let i = 0; i < assetIds.length; i++) {
    const asset_id = assetIds[i]?.trim() ?? "";
    const weight = weights[i];
    if (!asset_id) continue;
    if (!Number.isFinite(weight) || weight < 0) {
      return serverActionError("weights must be non-negative numbers");
    }
    const { error } = await supabase.from("ambience_layer_assets").insert({
      layer_id: layerId,
      asset_id,
      weight,
    });
    if (error) return serverActionError(error.message);
  }

  revalidatePath(`/sound/profiles/${profileId}/layers/${layerId}`);
  return {
    ok: true,
    href: saveHref(`/sound/profiles/${profileId}/layers/${layerId}`),
  };
}

export async function saveAmbienceZone(formData: FormData): Promise<ServerActionResult> {
  const auth = await requireSoundEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const id = String(formData.get("id") ?? "");
  const boundaryRaw = String(formData.get("boundary") ?? "");
  const priority = Number(formData.get("priority") ?? 0);
  const edgeFadeM = Number(formData.get("edge_fade_m") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return serverActionError("id and name required");

  const { error } = await supabase
    .from("ambience_zones")
    .update({ name, priority, edge_fade_m: edgeFadeM })
    .eq("id", id);
  if (error) return serverActionError(error.message);

  if (boundaryRaw.trim()) {
    const geo = parsePolygonGeoJson(boundaryRaw);
    if (typeof geo !== "string") return serverActionError(geo.error);
    const { error: bErr } = await supabase.rpc("fn_admin_set_zone_boundary", {
      p_kind: "ambience",
      p_zone_id: id,
      p_boundary_geojson: geo,
    });
    if (bErr) return serverActionError(bErr.message);
  }

  revalidatePath("/sound/zones");
  return { ok: true, href: saveHref("/sound/zones") };
}

export async function saveMusicZone(formData: FormData): Promise<ServerActionResult> {
  const auth = await requireSoundEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const id = String(formData.get("id") ?? "");
  const boundaryRaw = String(formData.get("boundary") ?? "");
  const priority = Number(formData.get("priority") ?? 0);
  const edgeFadeM = Number(formData.get("edge_fade_m") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return serverActionError("id and name required");

  const { error } = await supabase
    .from("music_zones")
    .update({ name, priority, edge_fade_m: edgeFadeM })
    .eq("id", id);
  if (error) return serverActionError(error.message);

  if (boundaryRaw.trim()) {
    const geo = parsePolygonGeoJson(boundaryRaw);
    if (typeof geo !== "string") return serverActionError(geo.error);
    const { error: bErr } = await supabase.rpc("fn_admin_set_zone_boundary", {
      p_kind: "music",
      p_zone_id: id,
      p_boundary_geojson: geo,
    });
    if (bErr) return serverActionError(bErr.message);
  }

  revalidatePath("/sound/zones");
  return { ok: true, href: saveHref("/sound/zones") };
}

export async function saveMusicCue(formData: FormData): Promise<ServerActionResult> {
  const auth = await requireSoundEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const id = String(formData.get("id") ?? "");
  if (!id) return serverActionError("cue id required");

  const conditionsRaw = String(formData.get("conditions_json") ?? "{}");
  const parsed = parseMusicConditionJson(conditionsRaw);
  if ("error" in parsed) return serverActionError(parsed.error);

  const strict = MusicCondition.safeParse(parsed);
  if (!strict.success) {
    return serverActionError(strict.error.errors[0]?.message ?? "invalid conditions");
  }

  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    priority: Number(formData.get("priority") ?? 0),
    min_dwell_s: Number(formData.get("min_dwell_s") ?? 0),
    crossfade_ms: Number(formData.get("crossfade_ms") ?? 6000),
    resolve_root_asset_id:
      String(formData.get("resolve_root_asset_id") ?? "").trim() || null,
    resolve_branch_asset_id:
      String(formData.get("resolve_branch_asset_id") ?? "").trim() || null,
    resolve_leaf_asset_id:
      String(formData.get("resolve_leaf_asset_id") ?? "").trim() || null,
    conditions: strict.data,
  };

  if (!payload.name) return serverActionError("name required");

  const { error } = await supabase.from("music_cues").update(payload).eq("id", id);
  if (error) return serverActionError(error.message);

  revalidatePath("/sound/music");
  revalidatePath(`/sound/music/cues/${id}`);
  return { ok: true, href: saveHref(`/sound/music/cues/${id}`) };
}

export async function saveMusicCueStems(
  formData: FormData,
): Promise<ServerActionResult> {
  const auth = await requireSoundEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const cueId = String(formData.get("cue_id") ?? "");
  if (!cueId) return serverActionError("cue id required");

  const stemIds = formData.getAll("stem_id").map((v) => String(v));
  const assetIds = formData.getAll("stem_asset_id").map((v) => String(v));
  const roles = formData.getAll("stem_role").map((v) => String(v));
  const gainDbs = formData.getAll("stem_gain_db").map((v) => Number(v));
  const stateGains = formData.getAll("stem_state_gains_json").map((v) =>
    String(v).trim(),
  );

  const rowCount = assetIds.filter((a) => a.trim()).length;
  const stemMsg = stemsOverMaxMessage(rowCount);
  if (stemMsg) return serverActionError(stemMsg);

  const keptIds = new Set(
    stemIds.filter((id) => id.trim()).map((id) => id.trim()),
  );

  const { data: existing } = await supabase
    .from("music_cue_stems")
    .select("id")
    .eq("cue_id", cueId);
  for (const row of existing ?? []) {
    const rowId = row.id as string;
    if (!keptIds.has(rowId)) {
      await supabase.from("music_cue_stems").delete().eq("id", rowId);
    }
  }

  for (let i = 0; i < assetIds.length; i++) {
    const asset_id = assetIds[i]?.trim() ?? "";
    if (!asset_id) continue;
    const gain_db = gainDbs[i] ?? 0;
    const role = roles[i]?.trim() || "stem";
    const stem_id = stemIds[i]?.trim() ?? "";
    let state_gains: unknown = [];
    const sgRaw = stateGains[i] ?? "[]";
    if (sgRaw.trim()) {
      try {
        state_gains = JSON.parse(sgRaw);
      } catch {
        return serverActionError("state_gains must be valid JSON array");
      }
    }

    const row = {
      asset_id,
      gain_db,
      role,
      state_gains,
      cue_id: cueId,
    };

    if (stem_id) {
      const { error } = await supabase
        .from("music_cue_stems")
        .update(row)
        .eq("id", stem_id);
      if (error) return serverActionError(error.message);
    } else {
      const { error } = await supabase.from("music_cue_stems").insert(row);
      if (error) return serverActionError(error.message);
    }
  }

  revalidatePath(`/sound/music/cues/${cueId}`);
  return { ok: true, href: saveHref(`/sound/music/cues/${cueId}`) };
}

export async function saveGroveSoundCues(
  formData: FormData,
): Promise<ServerActionResult> {
  const auth = await requireSoundEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const groveId = String(formData.get("grove_id") ?? "");
  if (!groveId) return serverActionError("grove id required");

  const depth = Number(formData.get("depth_bloom_texture_m") ?? 15);
  if (!Number.isFinite(depth) || depth <= 0) {
    return serverActionError("depth bloom texture must be positive");
  }
  const { error: gErr } = await supabase
    .from("groves")
    .update({ depth_bloom_texture_m: depth })
    .eq("id", groveId);
  if (gErr) return serverActionError(gErr.message);

  const kinds = [
    "beacon_root",
    "beacon_branch",
    "beacon_leaf",
    "threshold_motif_day",
    "threshold_motif_night",
  ] as const;

  for (const kind of kinds) {
    const assetId = String(formData.get(`asset_${kind}`) ?? "").trim();
    const { data: existing } = await supabase
      .from("grove_sound_cues")
      .select("id")
      .eq("grove_id", groveId)
      .eq("kind", kind)
      .maybeSingle();

    if (!assetId) {
      if (existing?.id) {
        await supabase.from("grove_sound_cues").delete().eq("id", existing.id);
      }
      continue;
    }

    if (existing?.id) {
      const { error } = await supabase
        .from("grove_sound_cues")
        .update({ asset_id: assetId })
        .eq("id", existing.id);
      if (error) return serverActionError(error.message);
    } else {
      const { error } = await supabase.from("grove_sound_cues").insert({
        grove_id: groveId,
        kind,
        asset_id: assetId,
      });
      if (error) return serverActionError(error.message);
    }
  }

  revalidatePath(`/sound/groves/${groveId}/cues`);
  return { ok: true, href: saveHref(`/sound/groves/${groveId}/cues`) };
}