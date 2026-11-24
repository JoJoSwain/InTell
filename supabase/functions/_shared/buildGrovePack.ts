import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { parseSnapshot } from "./from-shared/snapshots.ts";
import { roundCoord } from "./from-shared/canonicalJson.ts";
import { isL10nBlank } from "./from-shared/l10n.ts";
import { groveShape } from "./from-shared/groveShape.ts";
import { crossGroveLinks } from "./from-shared/web.ts";
import { pagePublishedSnapshots } from "./pageSnapshots.ts";
import { bboxFromMultiPolygon } from "./packBbox.ts";
import { persistPackIfChanged, type PackPersistResult } from "./packPersist.ts";
import {
  itemKey,
  loadReleaseOverlay,
  projectEntity,
  type ReleaseOverlay,
} from "./packSource.ts";

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

export type AssembleOptions = {
  /** When set, assemble from the preview source (release overlay). */
  previewReleaseId?: string;
  /** Preloaded overlay (avoids re-fetch when assembling many groves). */
  overlay?: ReleaseOverlay;
};

export async function buildGrovePackObject(
  supabase: SupabaseClient,
  groveId: string,
  options: AssembleOptions = {},
): Promise<{
  pack: Record<string, unknown>;
  assetShas: string[];
  bytesTotal: number;
  opening: { lat: number; lng: number } | null;
}> {
  const watermarks: string[] = [];
  const assetMap = new Map<string, { sha: string; ext: string; bytes: number; kind: string }>();
  const overlay =
    options.overlay ??
    (options.previewReleaseId
      ? await loadReleaseOverlay(supabase, options.previewReleaseId)
      : null);
  const preview = !!overlay;

  let groveSnap;
  let grovePublishedAt = new Date().toISOString();
  if (overlay?.items.has(itemKey("grove", groveId))) {
    const data = await projectEntity(supabase, "grove", groveId);
    groveSnap = parseSnapshot("grove", data);
    watermarks.push(grovePublishedAt);
  } else {
    const { data: groveSnapRow, error: gErr } = await supabase
      .from("published_snapshots")
      .select("entity, entity_id, data, published_at")
      .eq("entity", "grove")
      .eq("entity_id", groveId)
      .maybeSingle();
    if (gErr || !groveSnapRow) throw new Error(`grove snapshot missing: ${gErr?.message}`);
    groveSnap = parseSnapshot("grove", groveSnapRow.data);
    if (groveSnap.status !== "published" && !preview) {
      throw new Error(`grove snapshot not published: ${groveSnap.status}`);
    }
    grovePublishedAt = groveSnapRow.published_at;
    watermarks.push(groveSnapRow.published_at);
  }

  // P1: page past PostgREST max_rows so another grove's shape/links stay correct.
  const fragRows = await pagePublishedSnapshots(supabase, "fragment");

  const fragById = new Map<
    string,
    { row: SnapRow; data: ReturnType<typeof parseSnapshot<"fragment">> }
  >();
  const allFrags = new Map<string, ReturnType<typeof parseSnapshot<"fragment">>>();
  for (const row of fragRows) {
    const data = parseSnapshot("fragment", row.data);
    if (data.status === "published" || data.status === "retired") {
      allFrags.set(data.id, data);
    }
    if (data.groveId !== groveId) continue;
    if (data.status !== "published" && data.status !== "retired") continue;
    fragById.set(data.id, { row, data });
  }

  // Overlay fragment projections from the release
  if (overlay) {
    for (const key of overlay.items) {
      if (!key.startsWith("fragment:")) continue;
      const fid = key.slice("fragment:".length);
      const dataRaw = await projectEntity(supabase, "fragment", fid);
      const data = parseSnapshot("fragment", dataRaw);
      if (data.status !== "unpublished") allFrags.set(fid, data);
      if (data.groveId !== groveId) continue;
      if (data.status !== "published" && data.status !== "retired" && data.status !== "draft") {
        continue;
      }
      fragById.set(fid, {
        row: {
          entity: "fragment",
          entity_id: fid,
          data: dataRaw,
          published_at: new Date().toISOString(),
        },
        data,
      });
    }
  }

  const fragSnaps = [...fragById.values()];
  for (const f of fragSnaps) watermarks.push(f.row.published_at);

  const fragIds = fragSnaps.map((f) => f.data.id);

  // Current playable revisions only (preview: release revision wins)
  const revisions: Record<string, unknown>[] = [];
  for (const fid of fragIds) {
    let curId: string | null = overlay?.revisionByFragment.get(fid) ?? null;
    if (!curId) {
      const { data } = await supabase.rpc("fn_current_revision", {
        p_fragment_id: fid,
      });
      curId = data ? String(data) : null;
    }
    if (!curId) continue;
    const { data: rev } = await supabase
      .from("fragment_revisions")
      .select("*")
      .eq("id", curId)
      .single();
    if (!rev) continue;
    let contingencyRevisionNo: number;
    if (overlay?.revisionByFragment.get(fid) === String(rev.id)) {
      const { data: chain } = await supabase
        .from("fragment_revisions")
        .select("revision_no, change_kind")
        .eq("fragment_id", fid)
        .lte("revision_no", rev.revision_no as number);
      const contingents = (chain ?? [])
        .filter((r) => r.change_kind === "contingency")
        .map((r) => Number(r.revision_no));
      contingencyRevisionNo =
        contingents.length > 0
          ? Math.max(...contingents)
          : Number(rev.revision_no);
    } else {
      const { data } = await supabase.rpc("fn_contingency_revision_no", {
        p_fragment_id: fid,
      });
      contingencyRevisionNo = (data as number) ?? Number(rev.revision_no);
    }
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
      const breathPoints = Array.isArray(v.breath_points_ms)
        ? (v.breath_points_ms as number[])
        : [];
      const swellCues = Array.isArray(v.swell_cues_ms)
        ? (v.swell_cues_ms as number[])
        : [];
      const versionEntry: Record<string, unknown> = {
        lang: v.language,
        timeWindow: v.time_window,
        assetSha: asset.sha256,
        durationMs: asset.duration_ms,
        bytes: asset.bytes,
        transcript: v.transcript,
        ...(v.vtt ? { vtt: v.vtt } : {}),
        ...(breathPoints.length > 0 ? { breathPointsMs: breathPoints } : {}),
        ...(swellCues.length > 0 ? { swellCuesMs: swellCues } : {}),
      };
      if (!isL10nBlank(v.other_time_hint)) {
        versionEntry.otherTimeHint = v.other_time_hint;
      }
      packedVersions.push(versionEntry);
    }
    watermarks.push(String(rev.updated_at ?? ""));
    const contingencyNo = contingencyRevisionNo ?? Number(rev.revision_no);
    const revisionEntry: Record<string, unknown> = {
      id: rev.id,
      fragmentId: rev.fragment_id,
      revisionNo: rev.revision_no,
      changeKind: rev.change_kind,
      contingencyRevisionNo: contingencyNo,
      versions: packedVersions,
    };
    // changeTeaser from the contingency revision even when corrections followed
    if (contingencyNo > 1) {
      const { data: contingencyRev } = await supabase
        .from("fragment_revisions")
        .select("change_teaser")
        .eq("fragment_id", fid)
        .eq("revision_no", contingencyNo)
        .maybeSingle();
      if (contingencyRev && !isL10nBlank(contingencyRev.change_teaser)) {
        revisionEntry.changeTeaser = contingencyRev.change_teaser;
      }
    }
    revisions.push(revisionEntry);
  }

  // Characters linked to included fragments with published snapshots
  const charIds = new Set<string>();
  for (const f of fragSnaps) {
    for (const c of f.data.characters) charIds.add(c.characterId);
  }
  const characters = [];
  for (const cid of [...charIds].sort()) {
    let crow: { data: unknown; published_at: string } | null = null;
    if (overlay?.items.has(itemKey("character", cid))) {
      const dataRaw = await projectEntity(supabase, "character", cid);
      crow = { data: dataRaw, published_at: new Date().toISOString() };
    } else {
      const { data } = await supabase
        .from("published_snapshots")
        .select("data, published_at")
        .eq("entity", "character")
        .eq("entity_id", cid)
        .maybeSingle();
      crow = data;
    }
    if (!crow) continue;
    const c = parseSnapshot("character", crow.data);
    if (c.status !== "published" && c.status !== "retired" && !preview) continue;
    const characterLabel =
      typeof c.publicName?.en === "string" && c.publicName.en.trim()
        ? c.publicName.en.trim()
        : cid;
    if (!c.homeGroveId) {
      throw new Error(
        `character ${characterLabel} (${cid}) missing homeGroveId (PACK_BUILD_FAILED)`,
      );
    }
    watermarks.push(crow.published_at);
    if (!c.portraitImageId) {
      throw new Error(
        `character ${characterLabel} (${cid}) missing portrait (PACK_BUILD_FAILED)`,
      );
    }
    let irow: { data: unknown } | null = null;
    if (overlay?.items.has(itemKey("image", c.portraitImageId))) {
      irow = { data: await projectEntity(supabase, "image", c.portraitImageId) };
    } else {
      const { data } = await supabase
        .from("published_snapshots")
        .select("data")
        .eq("entity", "image")
        .eq("entity_id", c.portraitImageId)
        .maybeSingle();
      irow = data;
    }
    if (!irow) {
      throw new Error(
        `character ${cid} portrait image missing (PACK_BUILD_FAILED)`,
      );
    }
    const img = parseSnapshot("image", irow.data);
    assetMap.set(img.sha256, {
      sha: img.sha256,
      ext: img.ext,
      bytes: img.bytes,
      kind: "image",
    });
    characters.push({
      id: c.id,
      publicName: c.publicName,
      publicIntro: c.publicIntro,
      portraitSha: img.sha256,
      portraitAlt: img.altText,
      homeGroveId: c.homeGroveId,
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
      if (f.data.beaconAssetSha) {
        entry.beaconAssetSha = f.data.beaconAssetSha;
        assetMap.set(f.data.beaconAssetSha, {
          sha: f.data.beaconAssetSha,
          ext: "m4a",
          bytes: 1,
          kind: "beacon",
        });
      }
      if (f.data.resolveAssetSha) {
        entry.resolveAssetSha = f.data.resolveAssetSha;
        assetMap.set(f.data.resolveAssetSha, {
          sha: f.data.resolveAssetSha,
          ext: "m4a",
          bytes: 1,
          kind: "music_moment",
        });
      }
      if (f.data.teaserLockedAssetSha) {
        entry.teaserLockedAssetSha = f.data.teaserLockedAssetSha;
        assetMap.set(f.data.teaserLockedAssetSha, {
          sha: f.data.teaserLockedAssetSha,
          ext: "m4a",
          bytes: 1,
          kind: "voice_cue",
        });
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
    const cueEntry: Record<string, unknown> = {
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
    };
    if (cue.resolveRootAssetSha) {
      cueEntry.resolveRootAssetSha = cue.resolveRootAssetSha;
      assetMap.set(cue.resolveRootAssetSha, {
        sha: cue.resolveRootAssetSha,
        ext: "m4a",
        bytes: 1,
        kind: "music_moment",
      });
    }
    if (cue.resolveBranchAssetSha) {
      cueEntry.resolveBranchAssetSha = cue.resolveBranchAssetSha;
      assetMap.set(cue.resolveBranchAssetSha, {
        sha: cue.resolveBranchAssetSha,
        ext: "m4a",
        bytes: 1,
        kind: "music_moment",
      });
    }
    if (cue.resolveLeafAssetSha) {
      cueEntry.resolveLeafAssetSha = cue.resolveLeafAssetSha;
      assetMap.set(cue.resolveLeafAssetSha, {
        sha: cue.resolveLeafAssetSha,
        ext: "m4a",
        bytes: 1,
        kind: "music_moment",
      });
    }
    musicCues.push(cueEntry);
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

  // Grove-level sound cues (beacons + threshold motifs); omit when empty
  const { data: soundCueRows } = await supabase
    .from("grove_sound_cues")
    .select("kind, asset_id")
    .eq("grove_id", groveId);
  const soundCues: { kind: string; assetSha: string }[] = [];
  for (const row of soundCueRows ?? []) {
    const { data: a } = await supabase
      .from("audio_assets")
      .select("sha256, ext, bytes, kind")
      .eq("id", row.asset_id)
      .maybeSingle();
    if (!a) continue;
    assetMap.set(a.sha256, {
      sha: a.sha256,
      ext: a.ext,
      bytes: a.bytes,
      kind: a.kind,
    });
    soundCues.push({ kind: String(row.kind), assetSha: a.sha256 });
  }
  soundCues.sort((a, b) => a.kind.localeCompare(b.kind));

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

  // G1: opening is first published root by storyOrder then id (retired excluded).
  // Preview may use draft roots that are about to publish.
  const openingFrag = fragSnaps
    .filter((f) => {
      if (f.data.tier !== "root") return false;
      if (f.data.status === "published") return true;
      if (
        preview &&
        f.data.status !== "retired" &&
        f.data.status !== "unpublished"
      ) {
        return true;
      }
      return false;
    })
    .sort(
      (a, b) =>
        a.data.storyOrder - b.data.storyOrder ||
        a.data.id.localeCompare(b.data.id),
    )[0];
  if (!openingFrag) {
    throw new Error(
      `grove ${groveId} has no published root opening (PACK_BUILD_FAILED)`,
    );
  }
  const [openingLng, openingLat] = openingFrag.data.location.coordinates;
  const opening = {
    lat: roundCoord(openingLat),
    lng: roundCoord(openingLng),
  };

  const journeysRaw = groveSnap.journeys ?? {};
  const journeys: Record<string, unknown> = {};
  for (const mode of ["walk", "bike", "transit"] as const) {
    const passage = journeysRaw[mode];
    if (passage && !isL10nBlank(passage)) {
      journeys[mode] = passage;
    }
  }

  const shapeInputs = (snaps: { data: ReturnType<typeof parseSnapshot<"fragment">> }[]) =>
    snaps
      .filter((f) => f.data.status !== "retired")
      .map((f) => {
        const [lng, lat] = f.data.location.coordinates;
        return {
          id: f.data.id,
          tier: f.data.tier,
          lat,
          lng,
        };
      });

  const boundary = groveShape(shapeInputs(fragSnaps));
  if (!boundary) {
    throw new Error(`grove ${groveId} has no derived boundary (PACK_BUILD_FAILED)`);
  }

  const linkFragments = fragSnaps.map((f) => ({
    id: f.data.id,
    groveId: f.data.groveId,
    retired: f.data.status === "retired",
    lat: f.data.location.coordinates[1] ?? 0,
    lng: f.data.location.coordinates[0] ?? 0,
    requires: f.data.requires.map((group) => group.members.map((member) => member.fragmentId)),
  }));
  for (const data of allFrags.values()) {
    if (data.groveId === groveId) continue;
    if (data.status === "retired" || data.status === "unpublished") continue;
    linkFragments.push({
      id: data.id,
      groveId: data.groveId,
      retired: false,
      lat: data.location.coordinates[1] ?? 0,
      lng: data.location.coordinates[0] ?? 0,
      requires: data.requires.map((group) => group.members.map((member) => member.fragmentId)),
    });
  }

  const boundaries: { groveId: string; boundary: NonNullable<ReturnType<typeof groveShape>> }[] = [
    { groveId, boundary },
  ];
  const otherGroveIds = new Set(
    linkFragments.filter((f) => f.groveId !== groveId).map((f) => f.groveId),
  );
  for (const otherId of [...otherGroveIds].sort()) {
    const others = [...allFrags.values()].filter(
      (f) => f.groveId === otherId && f.status !== "retired" && f.status !== "unpublished",
    );
    const otherShape = groveShape(
      others.map((f) => ({
        id: f.id,
        tier: f.tier,
        lat: f.location.coordinates[1] ?? 0,
        lng: f.location.coordinates[0] ?? 0,
      })),
    );
    if (otherShape) boundaries.push({ groveId: otherId, boundary: otherShape });
  }
  const links = crossGroveLinks(groveId, linkFragments, boundaries);

  const pack: Record<string, unknown> = {
    schema: 4,
    groveId,
    regionId: groveSnap.regionId,
    packVersion: 0,
    builtAt: maxTs(watermarks),
    grove: {
      id: groveSnap.id,
      name: groveSnap.name,
      premise: groveSnap.premise,
      ...(groveSnap.websiteUrl ? { websiteUrl: groveSnap.websiteUrl } : {}),
      ...(groveSnap.gatheringsUrl
        ? { gatheringsUrl: groveSnap.gatheringsUrl }
        : {}),
      boundary,
      allowsSpeakerWildlifeSounds: groveSnap.allowsSpeakerWildlifeSounds,
      ...(groveSnap.growthCueAssetSha
        ? { growthCueAssetSha: groveSnap.growthCueAssetSha }
        : {}),
      // Omit default 15 so pre-A5 strict device parsers stay valid (sequencing).
      ...(groveSnap.depthBloomTextureM != null &&
      groveSnap.depthBloomTextureM !== 15
        ? { depthBloomTextureM: groveSnap.depthBloomTextureM }
        : {}),
      openingFragmentId: openingFrag.data.id,
      journeys,
    },
    characters,
    fragments,
    crossGroveLinks: links,
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
    ...(soundCues.length > 0 ? { soundCues } : {}),
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
    opening,
  };
}

export async function buildGrovePack(
  supabase: SupabaseClient,
  groveId: string,
  reason?: string,
  releaseId?: string,
): Promise<PackPersistResult> {
  const { pack, assetShas, bytesTotal, opening } = await buildGrovePackObject(
    supabase,
    groveId,
  );
  const boundary = (pack.grove as { boundary?: Parameters<typeof bboxFromMultiPolygon>[0] })
    ?.boundary;
  const bbox = boundary ? bboxFromMultiPolygon(boundary) : null;
  return persistPackIfChanged(supabase, {
    scope: "grove",
    scopeId: groveId,
    body: pack,
    assetShas,
    bytesTotal,
    reason,
    releaseId,
    opening,
    bbox,
  });
}
