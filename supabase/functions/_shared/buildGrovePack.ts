import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { parseSnapshot } from "./from-shared/snapshots.ts";
import { roundCoord } from "./from-shared/canonicalJson.ts";
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

type SnapRow = {
  entity: string;
  entity_id: string;
  data: unknown;
  published_at: string;
};

export async function buildGrovePackObject(
  supabase: SupabaseClient,
  groveId: string,
): Promise<{ pack: Record<string, unknown>; assetShas: string[]; bytesTotal: number }> {
  const watermarks: string[] = [];
  const assetMap = new Map<string, { sha: string; ext: string; bytes: number; kind: string }>();

  const { data: groveSnapRow, error: gErr } = await supabase
    .from("published_snapshots")
    .select("entity, entity_id, data, published_at")
    .eq("entity", "grove")
    .eq("entity_id", groveId)
    .maybeSingle();
  if (gErr || !groveSnapRow) throw new Error(`grove snapshot missing: ${gErr?.message}`);
  const groveSnap = parseSnapshot("grove", groveSnapRow.data);
  if (groveSnap.status !== "published") {
    throw new Error(`grove snapshot not published: ${groveSnap.status}`);
  }
  watermarks.push(groveSnapRow.published_at);

  const { data: fragRows } = await supabase
    .from("published_snapshots")
    .select("entity, entity_id, data, published_at")
    .eq("entity", "fragment");

  const fragSnaps = ((fragRows ?? []) as SnapRow[])
    .map((row) => {
      const data = parseSnapshot("fragment", row.data);
      return { row, data };
    })
    .filter((f) => f.data.groveId === groveId)
    .filter((f) => f.data.status === "published" || f.data.status === "retired");

  for (const f of fragSnaps) watermarks.push(f.row.published_at);

  const fragIds = fragSnaps.map((f) => f.data.id);

  // Current playable revisions only
  const revisions: Record<string, unknown>[] = [];
  for (const fid of fragIds) {
    const { data: curId } = await supabase.rpc("fn_current_revision", {
      p_fragment_id: fid,
    });
    if (!curId) continue;
    const { data: rev } = await supabase
      .from("fragment_revisions")
      .select("*")
      .eq("id", curId)
      .single();
    if (!rev) continue;
    const { data: contingencyRevisionNo } = await supabase.rpc(
      "fn_contingency_revision_no",
      { p_fragment_id: fid },
    );
    const { data: versions } = await supabase
      .from("revision_versions")
      .select("*")
      .eq("revision_id", rev.id);
    const packedVersions = [];
    for (const v of (versions ?? []).sort(
      (a, b) =>
        String(a.language).localeCompare(String(b.language)) ||
        String(a.time_window).localeCompare(String(b.time_window)),
    )) {
      const { data: asset } = await supabase
        .from("audio_assets")
        .select("*")
        .eq("id", v.narration_asset_id)
        .single();
      if (!asset) continue;
      assetMap.set(asset.sha256, {
        sha: asset.sha256,
        ext: asset.ext,
        bytes: asset.bytes,
        kind: asset.kind,
      });
      packedVersions.push({
        lang: v.language,
        timeWindow: v.time_window,
        assetSha: asset.sha256,
        durationMs: asset.duration_ms,
        bytes: asset.bytes,
        transcript: v.transcript,
        ...(v.vtt ? { vtt: v.vtt } : {}),
      });
    }
    watermarks.push(String(rev.updated_at ?? ""));
    revisions.push({
      id: rev.id,
      fragmentId: rev.fragment_id,
      revisionNo: rev.revision_no,
      changeKind: rev.change_kind,
      contingencyRevisionNo: contingencyRevisionNo ?? rev.revision_no,
      versions: packedVersions,
    });
  }

  // Characters linked to included fragments with published snapshots
  const charIds = new Set<string>();
  for (const f of fragSnaps) {
    for (const c of f.data.characters) charIds.add(c.characterId);
  }
  const characters = [];
  for (const cid of [...charIds].sort()) {
    const { data: crow } = await supabase
      .from("published_snapshots")
      .select("data, published_at")
      .eq("entity", "character")
      .eq("entity_id", cid)
      .maybeSingle();
    if (!crow) continue;
    const c = parseSnapshot("character", crow.data);
    if (c.status !== "published" && c.status !== "retired") continue;
    watermarks.push(crow.published_at);
    let portraitSha: string | undefined;
    let portraitAlt: Record<string, string> | undefined;
    if (c.portraitImageId) {
      const { data: irow } = await supabase
        .from("published_snapshots")
        .select("data")
        .eq("entity", "image")
        .eq("entity_id", c.portraitImageId)
        .maybeSingle();
      if (irow) {
        const img = parseSnapshot("image", irow.data);
        portraitSha = img.sha256;
        portraitAlt = img.altText;
        assetMap.set(img.sha256, {
          sha: img.sha256,
          ext: img.ext,
          bytes: img.bytes,
          kind: "image",
        });
      }
    }
    characters.push({
      id: c.id,
      publicName: c.publicName,
      publicIntro: c.publicIntro,
      ...(portraitSha ? { portraitSha } : {}),
      ...(portraitAlt ? { portraitAlt } : {}),
    });
  }

  // externalPrerequisites
  const externalPrerequisites: {
    fragmentId: string;
    groveId: string;
    contingencyRevisionNo: number;
  }[] = [];
  const seenExt = new Set<string>();
  for (const f of fragSnaps) {
    for (const g of f.data.requires) {
      for (const m of g.members) {
        const memberSnap = fragSnaps.find((x) => x.data.id === m.fragmentId);
        if (memberSnap) continue; // same grove
        if (seenExt.has(m.fragmentId)) continue;
        seenExt.add(m.fragmentId);
        const { data: mf } = await supabase
          .from("fragments")
          .select("id, grove_id")
          .eq("id", m.fragmentId)
          .maybeSingle();
        if (!mf) continue;
        const { data: cno } = await supabase.rpc("fn_contingency_revision_no", {
          p_fragment_id: m.fragmentId,
        });
        externalPrerequisites.push({
          fragmentId: m.fragmentId,
          groveId: mf.grove_id,
          contingencyRevisionNo: (cno as number) ?? 1,
        });
      }
    }
  }
  externalPrerequisites.sort((a, b) => a.fragmentId.localeCompare(b.fragmentId));

  const fragments = fragSnaps
    .slice()
    .sort(
      (a, b) =>
        a.data.storyOrder - b.data.storyOrder ||
        a.data.id.localeCompare(b.data.id),
    )
    .map((f) => {
      const [lng, lat] = f.data.location.coordinates;
      const requires = f.data.requires
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((g) =>
          g.members
            .slice()
            .sort(
              (a, b) =>
                a.sortOrder - b.sortOrder ||
                a.fragmentId.localeCompare(b.fragmentId),
            )
            .map((m) => m.fragmentId),
        );
      const entry: Record<string, unknown> = {
        id: f.data.id,
        tier: f.data.tier,
        isEnding: f.data.isEnding,
        requires,
        title: f.data.title,
        teaser: f.data.teaser,
        visibility: f.data.visibility,
        storyOrder: f.data.storyOrder,
        retired: f.data.status === "retired",
        lat: roundCoord(lat),
        lng: roundCoord(lng),
        threadIds: [...f.data.threadIds].sort(),
        characters: f.data.characters
          .slice()
          .sort((a, b) => a.characterId.localeCompare(b.characterId)),
      };
      if (f.data.visibility === "physical") {
        if (f.data.markerHash) entry.markerHash = f.data.markerHash;
      } else if (f.data.triggerRadiusM != null) {
        entry.radiusM = f.data.triggerRadiusM;
      }
      return entry;
    });

  // Music cues with published snapshots for this grove
  const { data: cueRows } = await supabase
    .from("published_snapshots")
    .select("data, published_at")
    .eq("entity", "music_cue");
  const musicCues = [];
  for (const row of cueRows ?? []) {
    const cue = parseSnapshot("music_cue", row.data);
    if (cue.status !== "published") continue;
    if (cue.groveId !== groveId && !cue.musicZoneId) continue;
    // grove-bound cues, or zone cues included via region (zone cues go in grove pack when intersecting — seed uses grove cues)
    if (cue.groveId && cue.groveId !== groveId) continue;
    if (!cue.groveId) continue; // zone-only cues stay in region pack for M3a simplicity unless grove-linked
    watermarks.push(row.published_at);
    for (const s of cue.stems) {
      assetMap.set(s.assetSha, {
        sha: s.assetSha,
        ext: "m4a",
        bytes: s.bytes,
        kind: "music_stem",
      });
    }
    musicCues.push({
      id: cue.id,
      useGroveBoundary: !!cue.groveId && !cue.musicZoneId,
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

  // Ambience zones with published snapshots in same region
  const { data: zoneRows } = await supabase
    .from("published_snapshots")
    .select("data, published_at")
    .eq("entity", "ambience_zone");
  const ambienceZones = [];
  for (const row of zoneRows ?? []) {
    const z = parseSnapshot("ambience_zone", row.data);
    if (z.status !== "published") continue;
    if (z.regionId !== groveSnap.regionId) continue;
    watermarks.push(row.published_at);
    ambienceZones.push({
      id: z.id,
      boundary: z.boundary,
      profileSlug: z.profileSlug,
      priority: z.priority,
      edgeFadeM: z.edgeFadeM,
    });
  }

  if (groveSnap.growthCueAssetSha) {
    const { data: ga } = await supabase
      .from("audio_assets")
      .select("sha256, ext, bytes, kind")
      .eq("sha256", groveSnap.growthCueAssetSha)
      .maybeSingle();
    if (ga) {
      assetMap.set(ga.sha256, {
        sha: ga.sha256,
        ext: ga.ext,
        bytes: ga.bytes,
        kind: ga.kind,
      });
    }
  }

  // Fill audio ext/bytes for stems from DB
  for (const [sha, meta] of assetMap) {
    if (meta.kind === "image") continue;
    const { data: a } = await supabase
      .from("audio_assets")
      .select("ext, bytes, kind")
      .eq("sha256", sha)
      .maybeSingle();
    if (a) {
      assetMap.set(sha, {
        sha,
        ext: a.ext,
        bytes: a.bytes,
        kind: a.kind,
      });
    }
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("status", "published");
  const qPack = (questions ?? [])
    .filter(
      (q) =>
        !q.anchor_fragment_id ||
        fragIds.includes(q.anchor_fragment_id as string),
    )
    .map((q) => ({
      id: q.id,
      text: q.text,
      ...(q.anchor_fragment_id
        ? { anchorFragmentId: q.anchor_fragment_id }
        : {}),
      ...(q.anchor_character_id
        ? { anchorCharacterId: q.anchor_character_id }
        : {}),
      requiresCompleted: q.requires_completed,
      opensAt: q.opens_at ? new Date(q.opens_at).toISOString() : undefined,
      closesAt: q.closes_at ? new Date(q.closes_at).toISOString() : undefined,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const { data: gatherings } = await supabase
    .from("gatherings")
    .select("*")
    .eq("grove_id", groveId);
  const gatheringsPack = (gatherings ?? [])
    .map((g) => ({
      title: g.title,
      startsAt: new Date(g.starts_at).toISOString(),
      url: g.url ?? "",
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const assets = [...assetMap.values()].sort((a, b) => a.sha.localeCompare(b.sha));

  const pack: Record<string, unknown> = {
    schema: 2,
    groveId,
    regionId: groveSnap.regionId,
    packVersion: 0,
    builtAt: maxTs(watermarks),
    grove: {
      id: groveSnap.id,
      name: groveSnap.name,
      premise: groveSnap.premise,
      accessNotes: groveSnap.accessNotes,
      ...(groveSnap.websiteUrl ? { websiteUrl: groveSnap.websiteUrl } : {}),
      ...(groveSnap.gatheringsUrl
        ? { gatheringsUrl: groveSnap.gatheringsUrl }
        : {}),
      boundary: groveSnap.boundary,
      allowsSpeakerWildlifeSounds: groveSnap.allowsSpeakerWildlifeSounds,
      ...(groveSnap.growthCueAssetSha
        ? { growthCueAssetSha: groveSnap.growthCueAssetSha }
        : {}),
    },
    characters,
    fragments,
    externalPrerequisites,
    revisions: revisions.sort(
      (a, b) =>
        String(a.fragmentId).localeCompare(String(b.fragmentId)) ||
        Number(a.revisionNo) - Number(b.revisionNo),
    ),
    questions: qPack,
    music: {
      cues: musicCues.sort((a, b) => String(a.id).localeCompare(String(b.id))),
    },
    ambienceZones: ambienceZones.sort((a, b) =>
      String(a.id).localeCompare(String(b.id)),
    ),
    gatherings: gatheringsPack,
    assets: assets.map((a) => ({
      sha: a.sha,
      ext: a.ext,
      bytes: a.bytes,
      kind: a.kind,
    })),
  };

  return {
    pack,
    assetShas: assets.map((a) => a.sha.toLowerCase()),
    bytesTotal: assets.reduce((n, a) => n + a.bytes, 0),
  };
}

export async function buildGrovePack(
  supabase: SupabaseClient,
  groveId: string,
  reason?: string,
  releaseId?: string,
): Promise<PackPersistResult> {
  const { pack, assetShas, bytesTotal } = await buildGrovePackObject(
    supabase,
    groveId,
  );
  return persistPackIfChanged(supabase, {
    scope: "grove",
    scopeId: groveId,
    body: pack,
    assetShas,
    bytesTotal,
    reason,
    releaseId,
  });
}
