import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { parseSnapshot } from "./from-shared/snapshots.ts";
import { persistPackIfChanged, type PackPersistResult } from "./packPersist.ts";

function maxTs(values: (string | null | undefined)[]): string {
  let best = "1970-01-01T00:00:00.000Z";
  for (const v of values) {
    if (!v) continue;
    const iso = new Date(v).toISOString();
    if (iso > best) best = iso;
  }
  return best;
}

export async function buildRegionPack(
  client: SupabaseClient,
  regionId: string,
  reason?: string,
  releaseId?: string,
): Promise<PackPersistResult> {
  const watermarks: string[] = [];
  const assetMap = new Map<
    string,
    { sha: string; ext: string; bytes: number; kind: string }
  >();

  const { data: region, error: rErr } = await client
    .from("regions")
    .select("id, timezone, pack_version, updated_at")
    .eq("id", regionId)
    .single();
  if (rErr || !region) throw new Error(`region ${regionId}: ${rErr?.message}`);
  watermarks.push(region.updated_at);

  const { data: sunPt, error: sunErr } = await client.rpc("fn_pack_geog_geojson", {
    p_scope: "region_sun",
    p_id: regionId,
  });
  if (sunErr || !sunPt) {
    throw new Error(`sun reference: ${sunErr?.message ?? "null"}`);
  }
  const coords = (sunPt as { coordinates: [number, number] }).coordinates;
  const sunReference = { lng: coords[0], lat: coords[1] };

  const { data: profileRows } = await client
    .from("published_snapshots")
    .select("data, published_at")
    .eq("entity", "ambience_profile");
  const ambienceProfiles = [];
  for (const row of profileRows ?? []) {
    const p = parseSnapshot("ambience_profile", row.data);
    if (p.regionId && p.regionId !== regionId) continue;
    if (p.regionId == null) continue; // skip global in M3a region pack unless needed
    watermarks.push(row.published_at);
    for (const layer of p.layers) {
      for (const sha of layer.assetShas) {
        const { data: a } = await client
          .from("audio_assets")
          .select("sha256, ext, bytes, kind")
          .eq("sha256", sha)
          .maybeSingle();
        if (a) {
          assetMap.set(a.sha256, {
            sha: a.sha256,
            ext: a.ext,
            bytes: a.bytes,
            kind: a.kind,
          });
        }
      }
    }
    ambienceProfiles.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      layers: p.layers.map((l) => ({
        id: l.id,
        name: l.name,
        kind: l.kind,
        timeWindow: l.timeWindow,
        wildlifeCall: l.wildlifeCall,
        speakerSafe: l.speakerSafe,
        assetShas: l.assetShas,
      })),
    });
  }

  const { data: zoneRows } = await client
    .from("published_snapshots")
    .select("data, published_at")
    .eq("entity", "ambience_zone");
  const ambienceZones = [];
  for (const row of zoneRows ?? []) {
    const z = parseSnapshot("ambience_zone", row.data);
    if (z.regionId !== regionId || z.status !== "published") continue;
    watermarks.push(row.published_at);
    ambienceZones.push({
      id: z.id,
      boundary: z.boundary,
      profileSlug: z.profileSlug,
      priority: z.priority,
      edgeFadeM: z.edgeFadeM,
    });
  }

  const { data: mzRows } = await client
    .from("published_snapshots")
    .select("data, published_at")
    .eq("entity", "music_zone");
  const musicZones = [];
  for (const row of mzRows ?? []) {
    const z = parseSnapshot("music_zone", row.data);
    if (z.regionId !== regionId || z.status !== "published") continue;
    watermarks.push(row.published_at);
    musicZones.push({
      id: z.id,
      boundary: z.boundary,
      edgeFadeM: z.edgeFadeM,
    });
  }

  const { data: cueRows } = await client
    .from("published_snapshots")
    .select("data, published_at")
    .eq("entity", "music_cue");
  const musicCues = [];
  for (const row of cueRows ?? []) {
    const cue = parseSnapshot("music_cue", row.data);
    if (cue.status !== "published" || !cue.musicZoneId) continue;
    if (!musicZones.some((z) => z.id === cue.musicZoneId)) continue;
    watermarks.push(row.published_at);
    for (const s of cue.stems) {
      const { data: a } = await client
        .from("audio_assets")
        .select("sha256, ext, bytes, kind")
        .eq("sha256", s.assetSha)
        .maybeSingle();
      if (a) {
        assetMap.set(a.sha256, {
          sha: a.sha256,
          ext: a.ext,
          bytes: a.bytes,
          kind: a.kind,
        });
      }
    }
    musicCues.push({
      id: cue.id,
      zoneId: cue.musicZoneId,
      timeWindow: cue.timeWindow,
      priority: cue.priority,
      conditions: cue.conditions,
      minDwellS: cue.minDwellS,
      crossfadeMs: cue.crossfadeMs,
      stems: cue.stems.map((s) => ({
        assetSha: s.assetSha,
        role: s.role,
        gainDb: s.gainDb,
        stateGains: s.stateGains.map((r) => ({
          when: r.when,
          gainDb: r.gain_db,
        })),
        loopStartMs: s.loopStartMs ?? null,
        loopEndMs: s.loopEndMs ?? null,
      })),
    });
  }

  const { data: uiRows } = await client
    .from("published_snapshots")
    .select("data, published_at")
    .eq("entity", "ui_cue");
  const uiCues = [];
  for (const row of uiRows ?? []) {
    const u = parseSnapshot("ui_cue", row.data);
    if (u.status !== "published") continue;
    if (u.regionId && u.regionId !== regionId) continue;
    watermarks.push(row.published_at);
    const { data: a } = await client
      .from("audio_assets")
      .select("sha256, ext, bytes, kind")
      .eq("sha256", u.assetSha)
      .maybeSingle();
    if (a) {
      assetMap.set(a.sha256, {
        sha: a.sha256,
        ext: a.ext,
        bytes: a.bytes,
        kind: a.kind,
      });
    }
    uiCues.push({
      key: u.key,
      language: u.language,
      assetSha: u.assetSha,
    });
  }

  const { data: landcover } = await client
    .from("landcover_grids")
    .select("*")
    .eq("region_id", regionId)
    .maybeSingle();
  const { data: landcoverClasses } = await client
    .from("landcover_classes")
    .select("code, name, profile_id");

  let landcoverOut: Record<string, unknown> | null = null;
  if (landcover) {
    // Prefer a real content sha when present; M2 seed stored a path, not a sha256.
    const rawSha = String(landcover.sha ?? "");
    const gridSha = /^[0-9a-f]{64}$/i.test(rawSha) ? rawSha.toLowerCase() : null;
    if (gridSha) {
      const classes = [];
      for (const c of landcoverClasses ?? []) {
        const { data: prof } = c.profile_id
          ? await client
              .from("ambience_profiles")
              .select("slug")
              .eq("id", c.profile_id)
              .maybeSingle()
          : { data: null };
        classes.push({
          code: String(c.code),
          profileSlug: prof?.slug ?? "",
        });
      }
      landcoverOut = {
        gridSha,
        h3Resolution: landcover.h3_resolution,
        classes,
      };
    }
  }

  const assets = [...assetMap.values()].sort((a, b) => a.sha.localeCompare(b.sha));

  const pack: Record<string, unknown> = {
    schema: 2,
    regionId,
    packVersion: 0,
    builtAt: maxTs(watermarks),
    timezone: region.timezone,
    sunReference: { lat: sunReference.lat, lng: sunReference.lng },
    ambienceProfiles: ambienceProfiles.sort((a, b) => a.slug.localeCompare(b.slug)),
    landcover: landcoverOut,
    ambienceZones: ambienceZones.sort((a, b) => String(a.id).localeCompare(String(b.id))),
    musicZones: musicZones.sort((a, b) => String(a.id).localeCompare(String(b.id))),
    musicCues: musicCues.sort((a, b) => String(a.id).localeCompare(String(b.id))),
    uiCues: uiCues.sort((a, b) => a.key.localeCompare(b.key) || a.language.localeCompare(b.language)),
    assets: assets.map((a) => ({
      sha: a.sha,
      ext: a.ext,
      bytes: a.bytes,
      kind: a.kind,
    })),
  };

  return persistPackIfChanged(client, {
    scope: "region",
    scopeId: regionId,
    body: pack,
    assetShas: assets.map((a) => a.sha.toLowerCase()),
    bytesTotal: assets.reduce((n, a) => n + a.bytes, 0),
    reason,
    releaseId,
  });
}
