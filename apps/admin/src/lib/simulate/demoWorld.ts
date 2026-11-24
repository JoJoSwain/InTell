/**
 * Self-contained Farmington-shaped world for the Simulator and its tests.
 * Coordinates align with supabase/fixtures/farmington-bird-refuge.json.
 */
import type { GeoJsonPolygon } from "@intell/shared";
import type { SimulatorWorld, SimFragment, SimMusicCue } from "./harness";
import type { AmbienceLayerInput, AmbienceProfileInput, AmbienceZoneInput } from "./harness";

export const DEMO_GROVE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";

export const DEMO_ORIGIN = { lat: 40.96122, lng: -111.92896 };

/** Large polygon covering the Farmington trail loop. */
export const MARSH_ZONE: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-111.931, 40.959],
      [-111.918, 40.959],
      [-111.918, 40.964],
      [-111.931, 40.964],
      [-111.931, 40.959],
    ],
  ],
};

/** Smaller urban zone overlapping the west edge for blend tests. */
export const URBAN_ZONE: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-111.932, 40.9605],
      [-111.9295, 40.9605],
      [-111.9295, 40.9625],
      [-111.932, 40.9625],
      [-111.932, 40.9605],
    ],
  ],
};

const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function bed(
  id: string,
  window: "day" | "night",
  opts: Partial<AmbienceLayerInput> = {},
): AmbienceLayerInput {
  return {
    id,
    kind: "bed",
    timeWindow: window,
    months,
    wildlifeCall: false,
    nestingMuteMonths: [],
    speakerSafe: true,
    gainDbMin: -18,
    gainDbMax: -10,
    panMin: -0.5,
    panMax: 0.5,
    pitchCentsMin: 0,
    pitchCentsMax: 0,
    noRepeatLast: 1,
    crossfadeMs: 4000,
    assets: [{ sha: `${id}-sha`, weight: 1 }],
    ...opts,
  };
}

function oneshot(
  id: string,
  window: "day" | "night",
  opts: Partial<AmbienceLayerInput> = {},
): AmbienceLayerInput {
  return {
    ...bed(id, window, opts),
    kind: "oneshot",
    meanIntervalS: 20,
    minIntervalS: 5,
    maxConcurrent: 1,
  };
}

export const DEMO_FRAGMENTS: SimFragment[] = [
  {
    id: "frag-root",
    lat: 40.9612169,
    lng: -111.9289567,
    radiusM: 10.67,
    tier: "root",
    visibility: "standard",
    title: "Beginning",
    beaconAssetSha: "beacon-root-sha",
  },
  {
    id: "frag-branch",
    lat: 40.9611602,
    lng: -111.9284257,
    radiusM: 10.67,
    tier: "branch",
    visibility: "standard",
    title: "Buildings 1",
    beaconAssetSha: "beacon-branch-sha",
    resolveAssetSha: "resolve-branch-override-sha",
  },
  {
    id: "frag-leaf",
    lat: 40.9616787,
    lng: -111.9283935,
    radiusM: 10.67,
    tier: "leaf",
    visibility: "standard",
    title: "Parking Lot 1",
  },
  {
    id: "frag-locked",
    lat: 40.96201,
    lng: -111.92833,
    radiusM: 10.67,
    tier: "branch",
    visibility: "locked",
    title: "Hidden",
    teaserLockedSha: "teaser-locked-sha",
  },
];

function musicCue(partial: Partial<SimMusicCue> & Pick<SimMusicCue, "id" | "name" | "timeWindow" | "priority">): SimMusicCue {
  return {
    boundary: MARSH_ZONE,
    edgeFadeM: 60,
    minDwellS: 0,
    crossfadeMs: 6000,
    stems: [],
    conditions: {},
    ...partial,
  };
}

export function buildDemoWorld(
  overrides: Partial<SimulatorWorld> = {},
): SimulatorWorld {
  const marshDay = bed("marsh-bed-day", "day");
  const marshNight = bed("marsh-bed-night", "night");
  const wildlife = oneshot("wildlife-call", "day", {
    wildlifeCall: true,
    speakerSafe: false,
  });
  const urbanDay = bed("urban-bed-day", "day");
  const urbanNight = bed("urban-bed-night", "night");

  const profiles: AmbienceProfileInput[] = [
    {
      slug: "marsh",
      density: 1,
      layers: [marshDay, marshNight, wildlife],
    },
    {
      slug: "urban",
      density: 1,
      layers: [urbanDay, urbanNight],
    },
  ];

  const ambienceZones: AmbienceZoneInput[] = [
    {
      id: "zone-marsh",
      boundary: MARSH_ZONE,
      profileSlug: "marsh",
      priority: 100,
      edgeFadeM: 40,
    },
    {
      id: "zone-urban",
      boundary: URBAN_ZONE,
      profileSlug: "urban",
      priority: 200,
      edgeFadeM: 30,
    },
  ];

  const defaultStems = [
    {
      assetSha: "stem-base-sha",
      gainDb: 0,
      stateGains: [],
    },
    {
      assetSha: "stem-layer-sha",
      gainDb: -3,
      stateGains: [
        {
          when: { heardAll: ["frag-branch"] },
          gainDb: 0,
        },
      ],
    },
  ];

  const cues: SimMusicCue[] = [
    musicCue({
      id: "cue-day-default",
      name: "Day default",
      timeWindow: "day",
      priority: 50,
      stems: defaultStems,
      resolveRootSha: "resolve-root-sha",
      resolveBranchSha: "resolve-branch-sha",
      resolveLeafSha: "resolve-leaf-sha",
    }),
    musicCue({
      id: "cue-day-growth",
      name: "Day after root+branch (growth step)",
      timeWindow: "day",
      priority: 90,
      // Distinct from the stem state_gain on the default cue (branch alone).
      conditions: { heardAll: ["frag-root", "frag-branch"] },
      stems: [
        {
          assetSha: "stem-growth-sha",
          gainDb: 0,
          stateGains: [],
        },
      ],
      resolveRootSha: "resolve-root-sha",
      resolveBranchSha: "resolve-branch-sha",
      resolveLeafSha: "resolve-leaf-sha",
    }),
    musicCue({
      id: "cue-night-default",
      name: "Night default",
      timeWindow: "night",
      priority: 50,
      stems: [
        {
          assetSha: "stem-night-sha",
          gainDb: 0,
          stateGains: [],
        },
      ],
    }),
  ];

  return {
    groveId: DEMO_GROVE_ID,
    fragments: DEMO_FRAGMENTS,
    cues,
    ambienceZones,
    profiles,
    classToProfile: new Map([
      ["90", "marsh"],
      ["21", "urban"],
    ]),
    landcoverCells: ["90", "90", "90", "90", "90", "90", "90"],
    motifDaySha: "motif-day-sha",
    motifNightSha: "motif-night-sha",
    depthBloomTextureM: 15,
    allowsSpeakerWildlife: false,
    hushIntervalMin: 7,
    ...overrides,
  };
}
