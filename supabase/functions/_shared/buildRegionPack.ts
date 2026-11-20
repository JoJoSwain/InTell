import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { asPolygon } from "./geo.ts";
import { persistPackIfChanged, type PackPersistResult } from "./packPersist.ts";

async function isCuePlayable(client: SupabaseClient, cueId: string): Promise<boolean> {
  const { data, error } = await client.rpc("fn_cue_is_playable", { p_cue_id: cueId });
  return !error && data === true;
}

async function playableLayerAssetIds(
  client: SupabaseClient,
  layerId: string,
): Promise<string[]> {
  const { data, error } = await client.rpc("fn_layer_assets_playable", { p_layer_id: layerId });
  if (error || !data) return [];
  return (data as string[]).slice().sort();
}

function maxIso(...values: (string | null | undefined)[]): string {
  let best = "";
  for (const v of values) {
    if (v && v > best) best = v;
  }
  return best || new Date(0).toISOString();
}

function l10nOrEmpty(v: unknown): Record<string, string> {
  if (v && typeof v === "object") return v as Record<string, string>;
  return {};
}

export async function buildRegionPack(
  client: SupabaseClient,
  regionId: string,
  reason?: string,
): Promise<PackPersistResult> {
  const { data: region, error: rErr } = await client
    .from("regions")
    .select("id, pack_version, updated_at")
    .eq("id", regionId)
    .single();
  if (rErr || !region) throw new Error(`region ${regionId}: ${rErr?.message ?? "missing"}`);

  const [
    { data: profiles },
    { data: layers },
    { data: layerAssets },
    { data: zones },
    { data: musicZones },
    { data: cues },
    { data: stems },
    { data: uiCues },
    { data: landcover },
    { data: landcoverClasses },
  ] = await Promise.all([
    client.from("ambience_profiles").select("*").eq("region_id", regionId),
    client.from("ambience_layers").select("*"),
    client.from("ambience_layer_assets").select("layer_id, asset_id, sort_order"),
    client.from("ambience_zones").select("*").eq("region_id", regionId).eq("status", "published"),
    client.from("music_zones").select("*").eq("region_id", regionId).eq("status", "published"),
    client.from("music_cues").select("*").eq("status", "published").not("music_zone_id", "is", null),
    client.from("music_cue_stems").select("*"),
    client.from("ui_cues").select("*").eq("region_id", regionId).eq("status", "published"),
    client.from("landcover_grids").select("*").eq("region_id", regionId).maybeSingle(),
    client.from("landcover_classes").select("code, name, profile_id"),
  ]);

  const profileIds = new Set((profiles ?? []).map((p) => p.id as string));
  const regionLayers = (layers ?? []).filter((l) => profileIds.has(l.profile_id as string));

  const assetIdSet = new Set<string>();
  const profileOut = [];
  for (const prof of profiles ?? []) {
    const profLayers = regionLayers.filter((l) => l.profile_id === prof.id);
    const layerOut = [];
    for (const layer of profLayers) {
      const playableIds = await playableLayerAssetIds(client, layer.id as string);
      for (const id of playableIds) assetIdSet.add(id);
      const shas: string[] = [];
      for (const id of playableIds) {
        const row = (layerAssets ?? []).find(
          (la) => la.layer_id === layer.id && la.asset_id === id,
        );
        if (row) shas.push(id);
      }
      const { data: assetsForLayer } = playableIds.length
        ? await client.from("audio_assets").select("id, sha256").in("id", playableIds)
        : { data: [] as { id: string; sha256: string }[] };
      const assetShas = (assetsForLayer ?? [])
        .map((a) => (a.sha256 as string).toLowerCase())
        .sort();
      layerOut.push({
        id: layer.id,
        kind: layer.kind,
        wildlifeCall: layer.wildlife_call,
        speakerSafe: layer.speaker_safe,
        assetShas,
      });
    }
    layerOut.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    profileOut.push({
      id: prof.id,
      slug: prof.slug,
      name: { en: prof.name as string },
      layers: layerOut,
    });
  }
  profileOut.sort((a, b) => a.slug.localeCompare(b.slug));

  const zoneCueIds = new Set<string>();
  for (const cue of cues ?? []) {
    if (cue.music_zone_id && (musicZones ?? []).some((z) => z.id === cue.music_zone_id)) {
      if (await isCuePlayable(client, cue.id as string)) zoneCueIds.add(cue.id as string);
    }
  }

  for (const cueId of zoneCueIds) {
    for (const s of (stems ?? []).filter((st) => st.cue_id === cueId)) {
      assetIdSet.add(s.asset_id as string);
    }
  }
  for (const ui of uiCues ?? []) assetIdSet.add(ui.asset_id as string);

  const assetIds = [...assetIdSet];
  const { data: assets } = assetIds.length
    ? await client.from("audio_assets").select("id, sha256, ext, bytes, kind").in("id", assetIds)
    : { data: [] as Record<string, unknown>[] };

  const assetById = new Map((assets ?? []).map((a) => [a.id as string, a]));
  const packAssets = (assets ?? [])
    .map((a) => ({
      sha: (a.sha256 as string).toLowerCase(),
      ext: a.ext as string,
      bytes: a.bytes as number,
      kind: a.kind as string,
    }))
    .sort((x, y) => x.sha.localeCompare(y.sha));

  const packCues = [];
  for (const cue of cues ?? []) {
    if (!zoneCueIds.has(cue.id as string)) continue;
    const cueStems = (stems ?? [])
      .filter((s) => s.cue_id === cue.id)
      .map((s) => {
        const a = assetById.get(s.asset_id as string);
        if (!a) throw new Error(`stem asset ${s.asset_id}`);
        return {
          assetSha: (a.sha256 as string).toLowerCase(),
          role: s.role as string,
          gainDb: Number(s.gain_db),
          stateGains: (s.state_gains as unknown[]) ?? [],
          loopStartMs: null,
          loopEndMs: null,
        };
      });
    packCues.push({
      id: cue.id,
      zoneId: cue.music_zone_id,
      priority: cue.priority,
      conditions: cue.conditions ?? {},
      minDwellS: cue.min_dwell_s,
      crossfadeMs: cue.crossfade_ms,
      stems: cueStems,
    });
  }
  packCues.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const profileSlugById = new Map((profiles ?? []).map((p) => [p.id as string, p.slug as string]));

  // Nullable when the region has no landcover_grids row (review #12)
  let landcoverOut = null;
  if (landcover && typeof landcover.file_path === "string") {
    const m = /([a-f0-9]{64})/i.exec(landcover.file_path as string);
    if (m) {
      const classes = (landcoverClasses ?? [])
        .filter((c) => c.profile_id && profileSlugById.has(c.profile_id as string))
        .map((c) => ({
          code: String(c.code),
          profileSlug: profileSlugById.get(c.profile_id as string) as string,
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
      landcoverOut = {
        gridSha: m[1]!.toLowerCase(),
        h3Resolution: landcover.h3_resolution,
        classes,
      };
    }
  }

  const watermarks: (string | null | undefined)[] = [region.updated_at as string];
  for (const p of profiles ?? []) watermarks.push(p.updated_at as string);
  const builtAt = maxIso(...watermarks);

  const body = {
    schema: 1,
    regionId,
    packVersion: 0,
    builtAt,
    ambienceProfiles: profileOut,
    landcover: landcoverOut,
    ambienceZones: await (async () => {
      const out = [];
      for (const z of zones ?? []) {
        const { data: bj } = await client.rpc("fn_pack_geog_geojson", {
          p_scope: "ambience_zone",
          p_id: z.id,
        });
        out.push({
          id: z.id,
          boundary: asPolygon(bj),
          profileSlug: profileSlugById.get(z.profile_id as string) ?? String(z.name),
          priority: z.priority,
          edgeFadeM: z.edge_fade_m,
        });
      }
      return out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    })(),
    musicZones: await (async () => {
      const out = [];
      for (const z of musicZones ?? []) {
        const { data: bj } = await client.rpc("fn_pack_geog_geojson", {
          p_scope: "music_zone",
          p_id: z.id,
        });
        out.push({
          id: z.id,
          boundary: asPolygon(bj),
          edgeFadeM: z.edge_fade_m,
        });
      }
      return out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    })(),
    musicCues: packCues,
    uiCues: (uiCues ?? [])
      .map((u) => {
        const a = assetById.get(u.asset_id as string);
        if (!a) throw new Error(`ui cue asset ${u.asset_id}`);
        return {
          key: u.key as string,
          language: u.language as string,
          assetSha: (a.sha256 as string).toLowerCase(),
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key) || a.language.localeCompare(b.language)),
    assets: packAssets,
  };

  const bytesTotal = packAssets.reduce((n, a) => n + a.bytes, 0);
  return persistPackIfChanged(client, {
    scope: "region",
    scopeId: regionId,
    body,
    assetShas: packAssets.map((a) => a.sha),
    bytesTotal,
    reason,
  });
}