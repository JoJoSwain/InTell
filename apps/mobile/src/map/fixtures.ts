import {
  GrovePack,
  RegionPack,
  groveShape,
  type GrovePack as GrovePackType,
  type RegionPack as RegionPackType,
} from "@intell/shared";

const SHA = "ab".repeat(32);

export function fixtureId(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const GROVE_ID = fixtureId(1);
const REGION_ID = fixtureId(2);
const STRESS_GROVE_ID = fixtureId(3);
const STRESS_REGION_ID = fixtureId(4);

type DemoFragment = {
  id: string;
  tier: "root" | "branch" | "leaf";
  name: string;
  requires: string[][];
  lat: number;
  lng: number;
  currentRevision: number;
  changeTeaser?: string;
};

const DEMO: DemoFragment[] = [
  { id: fixtureId(10), tier: "root", name: "R1", requires: [], lat: 40.76, lng: -111.891, currentRevision: 1 },
  {
    id: fixtureId(11),
    tier: "branch",
    name: "B1",
    requires: [],
    lat: 40.7606,
    lng: -111.8904,
    currentRevision: 2,
    changeTeaser: "A later telling of the same place.",
  },
  { id: fixtureId(12), tier: "branch", name: "B2", requires: [], lat: 40.7603, lng: -111.8914, currentRevision: 1 },
  { id: fixtureId(13), tier: "leaf", name: "L1", requires: [], lat: 40.7598, lng: -111.8908, currentRevision: 1 },
  { id: fixtureId(14), tier: "branch", name: "B3", requires: [], lat: 40.761, lng: -111.8916, currentRevision: 1 },
  { id: fixtureId(15), tier: "leaf", name: "L2", requires: [], lat: 40.7612, lng: -111.8906, currentRevision: 1 },
  { id: fixtureId(16), tier: "root", name: "R2", requires: [[fixtureId(10)]], lat: 40.7596, lng: -111.8918, currentRevision: 1 },
  { id: fixtureId(17), tier: "branch", name: "B4", requires: [[fixtureId(12)]], lat: 40.7594, lng: -111.8902, currentRevision: 1 },
  { id: fixtureId(18), tier: "leaf", name: "L3", requires: [[fixtureId(13)]], lat: 40.7614, lng: -111.8912, currentRevision: 1 },
];

export type FixtureCompletion = {
  fragment_id: string;
  revision_no: number;
  time_window: "day" | "night";
  completed_at: string;
  on_site: number;
  trigger: string;
  session_id: string;
};

export function buildDemo(): {
  grove: GrovePackType;
  region: RegionPackType;
  completions: FixtureCompletion[];
} {
  const shapeFragments = DEMO.map((fragment) => ({
    id: fragment.id,
    tier: fragment.tier,
    lat: fragment.lat,
    lng: fragment.lng,
  }));
  const boundary = groveShape(shapeFragments);
  if (!boundary) throw new Error("demo grove shape failed");

  const revisions = DEMO.flatMap((fragment) => {
    const rows = [];
    for (let revisionNo = 1; revisionNo <= fragment.currentRevision; revisionNo += 1) {
      rows.push(
        revision(
          fragment.id,
          revisionNo,
          revisionNo === fragment.currentRevision ? fragment.changeTeaser : undefined,
        ),
      );
    }
    return rows;
  });
  const grove = GrovePack.parse({
    schema: 4,
    groveId: GROVE_ID,
    regionId: REGION_ID,
    packVersion: 1,
    builtAt: "2026-11-23T00:00:00Z",
    grove: {
      id: GROVE_ID,
      name: { en: "Demo Grove" },
      premise: { en: "A small grove for checking the map." },
      boundary,
      allowsSpeakerWildlifeSounds: false,
      openingFragmentId: fixtureId(10),
      journeys: {},
    },
    characters: [],
    fragments: DEMO.map((fragment, index) => ({
      id: fragment.id,
      tier: fragment.tier,
      isEnding: false,
      requires: fragment.requires,
      title: { en: fragment.name },
      teaser: { en: `${fragment.name} teaser` },
      visibility: "standard",
      storyOrder: index,
      retired: false,
      lat: fragment.lat,
      lng: fragment.lng,
      radiusM: 30,
      threadIds: [],
      characters: [],
    })),
    externalPrerequisites: [],
    revisions,
    questions: [],
    music: { cues: [] },
    ambienceZones: [],
    gatherings: [],
    crossGroveLinks: [],
    assets: [{ sha: SHA, ext: "m4a", bytes: 1, kind: "narration" }],
  });
  const region = regionPack(REGION_ID, 40.76, -111.89);
  const completed = [fixtureId(14), fixtureId(15)];
  const completions: FixtureCompletion[] = [
    completion(fixtureId(11), 1),
    ...completed.map((id) => completion(id, 1)),
  ];
  return { grove, region, completions };
}

export function buildStress(): { grove: GrovePackType; region: RegionPackType } {
  const fragments = [];
  const revisions = [];
  for (let i = 0; i < 300; i += 1) {
    const id = fixtureId(1000 + i);
    const col = i % 20;
    const row = Math.floor(i / 20);
    fragments.push({
      id,
      tier: "leaf" as const,
      isEnding: false,
      requires: [],
      title: { en: `S${i}` },
      teaser: { en: `Stress ${i}` },
      visibility: "standard" as const,
      storyOrder: i,
      retired: false,
      lat: 40.8 + row * 0.0004,
      lng: -111.95 + col * 0.0004,
      radiusM: 20,
      threadIds: [],
      characters: [],
    });
    revisions.push(revision(id, 1));
  }
  const boundary = groveShape(
    fragments.map((fragment) => ({
      id: fragment.id,
      tier: fragment.tier,
      lat: fragment.lat,
      lng: fragment.lng,
    })),
  );
  if (!boundary) throw new Error("stress grove shape failed");
  const grove = GrovePack.parse({
    schema: 4,
    groveId: STRESS_GROVE_ID,
    regionId: STRESS_REGION_ID,
    packVersion: 1,
    builtAt: "2026-11-23T00:00:00Z",
    grove: {
      id: STRESS_GROVE_ID,
      name: { en: "Stress Grove" },
      premise: { en: "Three hundred markers for a pan check." },
      boundary,
      allowsSpeakerWildlifeSounds: false,
      openingFragmentId: fixtureId(1000),
      journeys: {},
    },
    characters: [],
    fragments,
    externalPrerequisites: [],
    revisions,
    questions: [],
    music: { cues: [] },
    ambienceZones: [],
    gatherings: [],
    crossGroveLinks: [],
    assets: [{ sha: SHA, ext: "m4a", bytes: 1, kind: "narration" }],
  });
  return { grove, region: regionPack(STRESS_REGION_ID, 40.8, -111.95) };
}

function regionPack(id: string, lat: number, lng: number): RegionPackType {
  return RegionPack.parse({
    schema: 2,
    regionId: id,
    packVersion: 1,
    builtAt: "2026-11-23T00:00:00Z",
    timezone: "America/Denver",
    sunReference: { lat, lng },
    ambienceProfiles: [],
    landcover: null,
    ambienceZones: [],
    musicZones: [],
    musicCues: [],
    uiCues: [],
    assets: [],
  });
}

function revision(fragmentId: string, revisionNo: number, changeTeaser?: string) {
  return {
    id: fixtureId(5000 + revisionNo * 100 + Number.parseInt(fragmentId.slice(-4), 16)),
    fragmentId,
    revisionNo,
    changeKind: "contingency" as const,
    contingencyRevisionNo: revisionNo,
    ...(changeTeaser ? { changeTeaser: { en: changeTeaser } } : {}),
    versions: (["day", "night"] as const).map((timeWindow) => ({
      lang: "en",
      timeWindow,
      assetSha: SHA,
      durationMs: 1000,
      bytes: 1,
      transcript: "A transcript for the fixture.",
    })),
  };
}

function completion(fragmentId: string, revisionNo: number): FixtureCompletion {
  return {
    fragment_id: fragmentId,
    revision_no: revisionNo,
    time_window: "day",
    completed_at: "2026-11-23T00:00:00Z",
    on_site: 1,
    trigger: "proximity",
    session_id: fixtureId(9),
  };
}
