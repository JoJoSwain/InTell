/**
 * Build a SimulatorWorld from strict GrovePack + RegionPack (staff preview).
 */
import {
  GrovePack,
  RegionPack,
  type GrovePack as GrovePackT,
  type RegionPack as RegionPackT,
} from "@intell/shared";
import type {
  AmbienceLayerInput,
  AmbienceProfileInput,
  AmbienceZoneInput,
  SimFragment,
  SimMusicCue,
  SimulatorWorld,
} from "./harness";
import { buildDemoWorld, DEMO_ORIGIN } from "./demoWorld";

export type SimulatorAssetUrl = {
  sha: string;
  ext: string;
  url: string;
  expiresAt: string;
};

export type SimulatorPackPayload = {
  grove: GrovePackT;
  region: RegionPackT;
  assets: SimulatorAssetUrl[];
};

export type WorldFromPacksResult = {
  world: SimulatorWorld;
  origin: { lat: number; lng: number };
  breathByFragment: Record<string, number[]>;
  swellByFragment: Record<string, number[]>;
  assetUrls: Map<string, string>;
  empty: boolean;
};

function l10nEn(value: unknown): string {
  if (value && typeof value === "object" && "en" in value) {
    const en = (value as { en?: unknown }).en;
    if (typeof en === "string") return en;
  }
  return "";
}

function multiToPolygon(
  boundary: GrovePackT["grove"]["boundary"],
): AmbienceZoneInput["boundary"] {
  const first = boundary.coordinates[0]?.[0];
  if (!first || first.length < 4) {
    return {
      type: "Polygon",
      coordinates: [
        [
          [-111.93, 40.96],
          [-111.92, 40.96],
          [-111.92, 40.962],
          [-111.93, 40.962],
          [-111.93, 40.96],
        ],
      ],
    };
  }
  return { type: "Polygon", coordinates: [first as [number, number][]] };
}

/**
 * Parse and convert preview/simulate packs into a harness world.
 * Throws zod errors for invalid packs (caller surfaces them).
 */
export function worldFromPacks(raw: {
  grove: unknown;
  region: unknown;
  assets?: SimulatorAssetUrl[];
}): WorldFromPacksResult {
  const grove = GrovePack.parse(raw.grove);
  const region = RegionPack.parse(raw.region);

  const fragments: SimFragment[] = grove.fragments.map((f) => ({
    id: f.id,
    lat: f.lat,
    lng: f.lng,
    radiusM: f.radiusM ?? 10.67,
    tier: f.tier,
    visibility: f.visibility === "physical" ? "physical" : "standard",
    title: l10nEn(f.title) || f.id.slice(0, 8),
    beaconAssetSha: f.beaconAssetSha ?? null,
    teaserLockedSha: f.teaserLockedAssetSha ?? null,
    resolveAssetSha: f.resolveAssetSha ?? null,
  }));

  // Locked-teaser fragments: mark visibility locked when teaser sha present
  // and they are not the opening (demo convention for harness teaser tests).
  for (const f of fragments) {
    if (f.teaserLockedSha && f.id !== grove.grove.openingFragmentId) {
      // Keep standard for map; teaser step uses teaserLockedSha.
    }
  }

  const groveBoundary = multiToPolygon(grove.grove.boundary);

  const cues: SimMusicCue[] = [];
  for (const c of grove.music.cues) {
    cues.push({
      id: c.id,
      name: c.id.slice(0, 8),
      timeWindow: c.timeWindow,
      priority: c.priority,
      conditions: c.conditions,
      minDwellS: c.minDwellS,
      crossfadeMs: c.crossfadeMs,
      boundary: c.zone ?? groveBoundary,
      edgeFadeM: c.edgeFadeM ?? 60,
      stems: c.stems.map((s) => ({
        assetSha: s.assetSha,
        gainDb: s.gainDb,
        stateGains: s.stateGains,
      })),
      resolveRootSha: c.resolveRootAssetSha,
      resolveBranchSha: c.resolveBranchAssetSha,
      resolveLeafSha: c.resolveLeafAssetSha,
    });
  }
  for (const c of region.musicCues) {
    const zone = region.musicZones.find((z) => z.id === c.zoneId);
    if (!zone) continue;
    cues.push({
      id: c.id,
      name: c.id.slice(0, 8),
      timeWindow: c.timeWindow,
      priority: c.priority,
      conditions: c.conditions,
      minDwellS: c.minDwellS,
      crossfadeMs: c.crossfadeMs,
      boundary: zone.boundary,
      edgeFadeM: zone.edgeFadeM,
      stems: c.stems.map((s) => ({
        assetSha: s.assetSha,
        gainDb: s.gainDb,
        stateGains: s.stateGains,
      })),
    });
  }

  const ambienceZones: AmbienceZoneInput[] = [
    ...grove.ambienceZones.map((z) => ({
      id: z.id,
      boundary: z.boundary,
      profileSlug: z.profileSlug,
      priority: z.priority,
      edgeFadeM: z.edgeFadeM,
    })),
    ...region.ambienceZones.map((z) => ({
      id: z.id,
      boundary: z.boundary,
      profileSlug: z.profileSlug,
      priority: z.priority,
      edgeFadeM: z.edgeFadeM,
    })),
  ];

  const profiles: AmbienceProfileInput[] = region.ambienceProfiles.map((p) => {
    const layers: AmbienceLayerInput[] = p.layers.map((l) => ({
      id: l.id,
      kind: l.kind === "bed" ? "bed" : "oneshot",
      timeWindow: l.timeWindow,
      months: l.months ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      wildlifeCall: l.wildlifeCall,
      nestingMuteMonths: l.nestingMuteMonths ?? [],
      speakerSafe: l.speakerSafe,
      gainDbMin: l.gainDbMin ?? -18,
      gainDbMax: l.gainDbMax ?? -10,
      panMin: l.panMin ?? -0.5,
      panMax: l.panMax ?? 0.5,
      pitchCentsMin: l.pitchCentsMin ?? 0,
      pitchCentsMax: l.pitchCentsMax ?? 0,
      noRepeatLast: l.noRepeatLast ?? 1,
      crossfadeMs: l.crossfadeMs ?? 4000,
      meanIntervalS: l.meanIntervalS,
      minIntervalS: l.minIntervalS,
      maxConcurrent: l.maxConcurrent,
      assets: l.assetShas.map((sha, i) => ({
        sha,
        weight: l.assetWeights?.[i] ?? 1,
      })),
    }));
    return { slug: p.slug, density: p.density ?? 1, layers };
  });

  const classToProfile = new Map<string, string>();
  for (const c of region.landcover?.classes ?? []) {
    classToProfile.set(c.code, c.profileSlug);
  }

  const motifDay = grove.soundCues?.find((s) => s.kind === "threshold_motif_day");
  const motifNight = grove.soundCues?.find(
    (s) => s.kind === "threshold_motif_night",
  );

  const opening = grove.fragments.find(
    (f) => f.id === grove.grove.openingFragmentId,
  );
  const origin = opening
    ? { lat: opening.lat, lng: opening.lng }
    : fragments[0]
      ? { lat: fragments[0].lat, lng: fragments[0].lng }
      : DEMO_ORIGIN;

  const breathByFragment: Record<string, number[]> = {};
  const swellByFragment: Record<string, number[]> = {};
  for (const rev of grove.revisions) {
    for (const v of rev.versions) {
      if (v.breathPointsMs?.length) {
        breathByFragment[rev.fragmentId] = [...v.breathPointsMs];
      }
      if (v.swellCuesMs?.length) {
        swellByFragment[rev.fragmentId] = [...v.swellCuesMs];
      }
    }
  }

  const assetUrls = new Map<string, string>();
  for (const a of raw.assets ?? []) {
    if (a.url) assetUrls.set(a.sha, a.url);
  }

  const empty = fragments.length === 0;

  const world: SimulatorWorld = {
    groveId: grove.groveId,
    fragments,
    cues,
    ambienceZones,
    profiles,
    classToProfile,
    landcoverCells: region.landcover
      ? Array(7).fill(region.landcover.classes[0]?.code ?? null)
      : [null, null, null, null, null, null, null],
    motifDaySha: motifDay?.assetSha ?? null,
    motifNightSha: motifNight?.assetSha ?? null,
    depthBloomTextureM: grove.grove.depthBloomTextureM ?? 15,
    allowsSpeakerWildlife: grove.grove.allowsSpeakerWildlifeSounds,
    hushIntervalMin: 7,
  };

  return {
    world,
    origin,
    breathByFragment,
    swellByFragment,
    assetUrls,
    empty,
  };
}

/** Fallback when pack build fails or grove has no content. */
export function demoWorldFallback(groveId: string): WorldFromPacksResult {
  const world = buildDemoWorld({ groveId });
  return {
    world,
    origin: DEMO_ORIGIN,
    breathByFragment: {},
    swellByFragment: {},
    assetUrls: new Map(),
    empty: true,
  };
}
