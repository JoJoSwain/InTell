/**
 * Listening Simulator pure harness — same shared functions the phone will use.
 * No Web Audio required; the UI may attach a WebAudioEngine separately.
 */
import {
  AFTERGLOW_MS,
  accentAllowed,
  activeProfiles,
  allocateVoices,
  beaconMix,
  chooseBeacon,
  createSeededRng,
  depthConditionLatched,
  eligibleLayers,
  hushStep,
  initialHushState,
  initialLockedTeaserState,
  initialMixLevelState,
  initialThresholdMotifState,
  insideTierBuffersLatched,
  localDayKey,
  lockedTeaserStep,
  mixLevelFor,
  musicConditionMatches,
  ONESHOT_CONCURRENT_GLOBAL_MAX,
  pickResolve,
  selectMusicCue,
  selectMusicCueDeferred,
  shedLayers,
  stemGainDb,
  thresholdMotifStep,
  type AmbienceLayerInput,
  type AmbienceProfileInput,
  type AmbienceZoneInput,
  type AudioRoute,
  type GeoJsonArea,
  type HushState,
  type MusicCondition,
  type MusicCueInput,
  type MusicStemInput,
  type StoryState,
  type ThresholdMotifState,
  type TimeWindow,
  distanceMeters,
  pointInPolygon,
} from "@intell/shared";

/** Local mirrors of shared types not yet re-exported from the package barrel. */
type LockedTeaserState = ReturnType<typeof initialLockedTeaserState>;
type MixLevelState = ReturnType<typeof initialMixLevelState>;
type VoiceRequest = { kind: "narration" | "teaser" | "stem" | "bed" | "accent" | "beacon" | "moment"; id: string };

export type SimFragment = {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  tier: "root" | "branch" | "leaf";
  visibility: "standard" | "physical" | "locked";
  title: string;
  beaconAssetSha?: string | null;
  teaserLockedSha?: string | null;
  resolveAssetSha?: string | null;
};

export type SimMusicCue = MusicCueInput & {
  name: string;
  resolveRootSha?: string;
  resolveBranchSha?: string;
  resolveLeafSha?: string;
};

export type SimEvent =
  | { type: "time_window"; window: TimeWindow }
  | { type: "profile_weights"; weights: { profileSlug: string; weight: number }[] }
  | { type: "eligible_layers"; layerIds: string[] }
  | { type: "oneshot_cap"; active: number; denied: boolean }
  | { type: "music_cue"; cueId: string | null; deferred: boolean }
  | { type: "stem_gain"; stemIndex: number; gainDb: number }
  | { type: "wildlife_silenced"; silenced: boolean }
  | { type: "depth_bloom"; inside: boolean; depthM: number }
  | { type: "buffer"; tiers: ("root" | "branch" | "leaf")[] }
  | { type: "beacon"; fragmentId: string | null; pan: number; gainDb: number }
  | { type: "motif"; playSha?: string }
  | { type: "resolve"; kind: "asset" | "pause"; detail: string }
  | { type: "locked_teaser"; playSha?: string }
  | { type: "hush"; phase: string }
  | { type: "mix_level"; shed: string[]; shedIndex: number }
  | { type: "accent_blocked_breath" }
  | { type: "voice_budget"; granted: string[]; denied: string[] }
  | { type: "gpx_tick"; tMs: number; lat: number; lng: number; speed: 1 | 4 };

export type SimulatorHarnessState = {
  lat: number;
  lng: number;
  atMs: number;
  month: number;
  /** Forced window for the rail Day/Night toggle; null = sun-derived. */
  forcedWindow: TimeWindow | null;
  route: AudioRoute;
  beaconsEnabled: boolean;
  completed: Set<string>;
  depthM: number;
  narrationPlaying: boolean;
  narrationPositionMs: number;
  breathPointsMs: number[];
  afterglowEndsAt: number | null;
  pendingGrowthCueId: string | null;
  hush: HushState;
  motif: ThresholdMotifState;
  teaser: LockedTeaserState;
  mix: ReturnType<typeof initialMixLevelState>;
  activeOneshots: number;
  currentCueId: string | null;
  cueStartedAt: number | null;
  depthBloomInside: boolean;
  bufferTiers: ("root" | "branch" | "leaf")[];
  currentBeaconId: string | null;
  lastBeaconPan: number;
  timeZone: string;
  events: SimEvent[];
};

export type SimulatorWorld = {
  groveId: string;
  fragments: SimFragment[];
  cues: SimMusicCue[];
  ambienceZones: AmbienceZoneInput[];
  profiles: AmbienceProfileInput[];
  classToProfile: Map<string, string>;
  landcoverCells: (string | null)[];
  motifDaySha?: string | null;
  motifNightSha?: string | null;
  depthBloomTextureM: number;
  allowsSpeakerWildlife: boolean;
  hushIntervalMin: number;
};

export function createHarnessState(
  origin: { lat: number; lng: number },
  atMs: number,
  opts?: { timeZone?: string; dayKey?: string },
): SimulatorHarnessState {
  const timeZone = opts?.timeZone ?? "America/Denver";
  const dayKey =
    opts?.dayKey ?? localDayKey(new Date(atMs), timeZone);
  return {
    lat: origin.lat,
    lng: origin.lng,
    atMs,
    month: 6,
    forcedWindow: "day",
    route: "headphones",
    beaconsEnabled: true,
    completed: new Set(),
    depthM: 0,
    narrationPlaying: false,
    narrationPositionMs: 0,
    breathPointsMs: [],
    afterglowEndsAt: null,
    pendingGrowthCueId: null,
    hush: initialHushState(),
    motif: initialThresholdMotifState(),
    teaser: initialLockedTeaserState(dayKey),
    mix: initialMixLevelState(),
    activeOneshots: 0,
    currentCueId: null,
    cueStartedAt: null,
    depthBloomInside: false,
    bufferTiers: [],
    currentBeaconId: null,
    lastBeaconPan: 0,
    timeZone,
    events: [],
  };
}

export type SimulatorTickPatch = Partial<{
  lat: number;
  lng: number;
  atMs: number;
  month: number;
  forcedWindow: TimeWindow | null;
  route: AudioRoute;
  beaconsEnabled: boolean;
  depthM: number;
  narrationPlaying: boolean;
  narrationPositionMs: number;
  breathPointsMs: number[];
  completeFragmentId: string;
  endNarration: boolean;
  startNarration: boolean;
  enterGrove: boolean;
  oneshotRequest: boolean;
  oneshotEnded: boolean;
  checkAccent: boolean;
  clockStarving: boolean;
  batterySaver: boolean;
  thermal: boolean;
  crossfading: boolean;
  lockedTeaserTap: { fragmentId: string };
  gpx: { tMs: number; speed: 1 | 4 };
}>;

function storyOf(
  state: SimulatorHarnessState,
  window: TimeWindow,
): StoryState {
  const last = [...state.completed].at(-1);
  return {
    groveId: undefined,
    playingFragmentId: undefined,
    playingTier: undefined,
    playingThreadIds: [],
    lastFragmentId: last,
    lastTier: undefined,
    lastThreadIds: [],
    heard: state.completed,
    timeWindow: window,
    narrationPlaying: state.narrationPlaying,
    depthM: state.depthM,
    insideTierBuffers: state.bufferTiers,
  };
}

export function simulatorTick(
  state: SimulatorHarnessState,
  world: SimulatorWorld,
  patch: SimulatorTickPatch = {},
): SimulatorHarnessState {
  const next: SimulatorHarnessState = {
    ...state,
    completed: new Set(state.completed),
    events: [...state.events],
    hush: { ...state.hush },
    motif: { ...state.motif },
    teaser: {
      ...state.teaser,
      playedFragmentIds: [...state.teaser.playedFragmentIds],
    },
    mix: { ...state.mix },
    bufferTiers: [...state.bufferTiers],
  };

  if (patch.lat != null) next.lat = patch.lat;
  if (patch.lng != null) next.lng = patch.lng;
  if (patch.atMs != null) next.atMs = patch.atMs;
  if (patch.month != null) next.month = patch.month;
  if (patch.forcedWindow !== undefined) next.forcedWindow = patch.forcedWindow;
  if (patch.route != null) next.route = patch.route;
  if (patch.beaconsEnabled != null) next.beaconsEnabled = patch.beaconsEnabled;
  if (patch.depthM != null) next.depthM = patch.depthM;
  if (patch.narrationPlaying != null) next.narrationPlaying = patch.narrationPlaying;
  if (patch.narrationPositionMs != null) {
    next.narrationPositionMs = patch.narrationPositionMs;
  }
  if (patch.breathPointsMs) next.breathPointsMs = [...patch.breathPointsMs];
  if (patch.completeFragmentId) next.completed.add(patch.completeFragmentId);

  if (patch.gpx) {
    next.events.push({
      type: "gpx_tick",
      tMs: patch.gpx.tMs,
      lat: next.lat,
      lng: next.lng,
      speed: patch.gpx.speed,
    });
  }

  const at = new Date(next.atMs);
  const window: TimeWindow = next.forcedWindow ?? "day";
  next.events.push({ type: "time_window", window });

  const point = { lat: next.lat, lng: next.lng };

  // Zone / landcover profile blend
  const weights = activeProfiles({
    zones: world.ambienceZones,
    point,
    landcoverCells: world.landcoverCells,
    classToProfile: world.classToProfile,
  });
  next.events.push({ type: "profile_weights", weights });

  // Eligible layers (Day/Night + wildlife / speaker)
  const routeForLayers: "speaker" | "headphones" =
    next.route === "speaker" ? "speaker" : "headphones";
  const layerIds: string[] = [];
  let wildlifeSilenced = false;
  for (const w of weights) {
    const profile = world.profiles.find((p) => p.slug === w.profileSlug);
    if (!profile) continue;
    const layers = eligibleLayers({
      profile,
      timeWindow: window,
      month: next.month,
      route: routeForLayers,
      muteAllSurroundingsOnSpeaker: !world.allowsSpeakerWildlife,
      hushActive: next.hush.phase !== "idle" && next.hush.phase !== "fadingIn",
    });
    for (const layer of layers) layerIds.push(layer.id);
    if (
      routeForLayers === "speaker" &&
      profile.layers.some((l) => l.wildlifeCall || !l.speakerSafe)
    ) {
      wildlifeSilenced = true;
    }
  }
  if (routeForLayers === "speaker" && !world.allowsSpeakerWildlife) {
    wildlifeSilenced = true;
  }
  next.events.push({ type: "eligible_layers", layerIds });
  next.events.push({ type: "wildlife_silenced", silenced: wildlifeSilenced });

  // Depth bloom + buffers
  next.depthBloomInside = depthConditionLatched(
    next.depthBloomInside,
    next.depthM,
    world.depthBloomTextureM,
  );
  next.events.push({
    type: "depth_bloom",
    inside: next.depthBloomInside,
    depthM: next.depthM,
  });
  next.bufferTiers = insideTierBuffersLatched(
    next.bufferTiers,
    point,
    world.fragments.map((f) => ({
      tier: f.tier,
      lat: f.lat,
      lng: f.lng,
    })),
  );
  next.events.push({ type: "buffer", tiers: [...next.bufferTiers] });

  // Oneshot global cap
  let oneshotDenied = false;
  if (patch.oneshotEnded && next.activeOneshots > 0) {
    next.activeOneshots -= 1;
  }
  if (patch.oneshotRequest) {
    if (next.activeOneshots >= ONESHOT_CONCURRENT_GLOBAL_MAX) {
      oneshotDenied = true;
    } else {
      next.activeOneshots += 1;
    }
  }
  next.events.push({
    type: "oneshot_cap",
    active: next.activeOneshots,
    denied: oneshotDenied,
  });

  // Accent vs breath
  if (patch.checkAccent && next.narrationPlaying) {
    if (!accentAllowed(next.narrationPositionMs, next.breathPointsMs)) {
      next.events.push({ type: "accent_blocked_breath" });
    }
  }

  // Beacon
  const headphones =
    next.route === "headphones" || next.route === "bluetooth";
  const playableUnexplored = world.fragments
    .filter(
      (f) =>
        f.visibility !== "physical" &&
        f.visibility !== "locked" &&
        !next.completed.has(f.id),
    )
    .map((f) => ({
      id: f.id,
      tier: f.tier,
      lat: f.lat,
      lng: f.lng,
    }));
  const beaconId = chooseBeacon({
    listener: point,
    playableUnexplored,
    currentId: next.currentBeaconId,
    narrationPlaying: next.narrationPlaying,
    beaconsEnabled: next.beaconsEnabled,
    headphones,
  });
  next.currentBeaconId = beaconId;
  if (beaconId) {
    const target = world.fragments.find((f) => f.id === beaconId)!;
    const mix = beaconMix(point, 0, { lat: target.lat, lng: target.lng }, next.lastBeaconPan);
    next.lastBeaconPan = mix.pan;
    next.events.push({
      type: "beacon",
      fragmentId: beaconId,
      pan: mix.pan,
      gainDb: mix.gainDb,
    });
  } else {
    next.events.push({
      type: "beacon",
      fragmentId: null,
      pan: next.lastBeaconPan,
      gainDb: Number.NEGATIVE_INFINITY,
    });
  }

  // Motif
  if (patch.enterGrove) {
    const motif = thresholdMotifStep(next.motif, {
      type: "groveEntered",
      at: next.atMs,
      depthM: next.depthM,
      timeWindow: window,
      motifDaySha: world.motifDaySha ?? undefined,
      motifNightSha: world.motifNightSha ?? undefined,
    });
    next.motif = motif.state;
    next.events.push({ type: "motif", playSha: motif.playSha });
  } else {
    const motif = thresholdMotifStep(next.motif, {
      type: "tick",
      at: next.atMs,
      narrationPlaying: next.narrationPlaying,
      depthM: next.depthM,
    });
    next.motif = motif.state;
    if (motif.playSha) next.events.push({ type: "motif", playSha: motif.playSha });
  }

  if (patch.startNarration) {
    next.narrationPlaying = true;
    const motif = thresholdMotifStep(next.motif, {
      type: "narrationStarted",
      at: next.atMs,
    });
    next.motif = motif.state;
  }

  // Afterglow resolve + pending growth-step cue (before music select)
  if (patch.endNarration) {
    next.narrationPlaying = false;
    next.afterglowEndsAt = next.atMs + AFTERGLOW_MS;
    const completedId = [...next.completed].at(-1);
    const frag = world.fragments.find((f) => f.id === completedId);
    const tier = frag?.tier ?? "root";
    const cue = world.cues.find((c) => c.id === next.currentCueId);
    const pick = pickResolve({
      tier,
      cue: {
        resolveRootSha: cue?.resolveRootSha,
        resolveBranchSha: cue?.resolveBranchSha,
        resolveLeafSha: cue?.resolveLeafSha,
      },
      fragmentResolveSha: frag?.resolveAssetSha ?? undefined,
    });
    next.events.push({
      type: "resolve",
      kind: pick.kind,
      detail:
        pick.kind === "asset" ? pick.assetSha : `pause:${pick.ms}`,
    });
    const storyAfter = storyOf(next, window);
    if (completedId) {
      const f = world.fragments.find((x) => x.id === completedId);
      if (f) storyAfter.lastTier = f.tier;
    }
    const would = selectMusicCue({
      cues: world.cues,
      point,
      story: storyAfter,
      current: null,
      now: at,
    });
    if (
      would.cue &&
      would.cue.id !== next.currentCueId &&
      would.cue.priority > (cue?.priority ?? -1)
    ) {
      next.pendingGrowthCueId = would.cue.id;
    }
    const motif = thresholdMotifStep(next.motif, {
      type: "narrationEnded",
      at: next.atMs,
    });
    next.motif = motif.state;
    if (motif.playSha) next.events.push({ type: "motif", playSha: motif.playSha });
  }

  // After afterglow ends, allow the deferred growth cue on this tick
  const afterglowActive =
    next.pendingGrowthCueId != null &&
    next.afterglowEndsAt != null &&
    next.atMs < next.afterglowEndsAt;
  if (
    next.pendingGrowthCueId &&
    next.afterglowEndsAt != null &&
    next.atMs >= next.afterglowEndsAt
  ) {
    next.pendingGrowthCueId = null;
    next.afterglowEndsAt = null;
  }

  // Music cue + stem gains (after afterglow / growth bookkeeping)
  const story = storyOf(next, window);
  if (story.lastFragmentId) {
    const frag = world.fragments.find((f) => f.id === story.lastFragmentId);
    if (frag) story.lastTier = frag.tier;
  }

  const cueResult = selectMusicCueDeferred({
    cues: world.cues,
    point,
    story,
    current:
      next.currentCueId && next.cueStartedAt != null
        ? { cueId: next.currentCueId, startedAt: new Date(next.cueStartedAt) }
        : null,
    now: at,
    pendingGrowthCueId: afterglowActive ? next.pendingGrowthCueId : null,
    afterglowEndsAt: afterglowActive ? next.afterglowEndsAt : null,
    at: next.atMs,
  });

  if (cueResult.cue) {
    if (cueResult.cue.id !== next.currentCueId) {
      next.currentCueId = cueResult.cue.id;
      next.cueStartedAt = next.atMs;
    }
    next.events.push({
      type: "music_cue",
      cueId: cueResult.cue.id,
      deferred: afterglowActive,
    });
    cueResult.cue.stems.forEach((stem, i) => {
      next.events.push({
        type: "stem_gain",
        stemIndex: i,
        gainDb: stemGainDb(stem, story),
      });
    });
  } else {
    next.currentCueId = null;
    next.cueStartedAt = null;
    next.events.push({
      type: "music_cue",
      cueId: null,
      deferred: afterglowActive,
    });
  }

  // Locked teaser
  if (patch.lockedTeaserTap) {
    const frag = world.fragments.find(
      (f) => f.id === patch.lockedTeaserTap!.fragmentId,
    );
    const dayKey = localDayKey(at, next.timeZone);
    const teaser = lockedTeaserStep(next.teaser, {
      at: next.atMs,
      dayKey,
      reason: frag?.visibility === "locked" ? "locked" : "wrongTime",
      fragmentId: patch.lockedTeaserTap.fragmentId,
      teaserSha: frag?.teaserLockedSha ?? undefined,
      narrationPlaying: next.narrationPlaying,
    });
    next.teaser = teaser.state;
    next.events.push({ type: "locked_teaser", playSha: teaser.playSha });
  }

  // Hush
  const insideGrove = world.fragments.some((f) =>
    pointInPolygon(point, {
      type: "Polygon",
      coordinates: [
        // crude: use point-in fragment radius as "inside" proxy for hush
        // Real grove shape is MultiPolygon; harness uses distance to any fragment
        [
          [f.lng - 0.01, f.lat - 0.01],
          [f.lng + 0.01, f.lat - 0.01],
          [f.lng + 0.01, f.lat + 0.01],
          [f.lng - 0.01, f.lat + 0.01],
          [f.lng - 0.01, f.lat - 0.01],
        ],
      ],
    }),
  );
  // Prefer distance-based inside check
  const nearFragment = world.fragments.some(
    (f) => distanceMeters(point, f) <= 200,
  );
  const hush = hushStep({
    state: next.hush,
    settingOn: true,
    insideGrove: insideGrove || nearFragment,
    narrationPlaying: next.narrationPlaying,
    queuedFragment: false,
    lastNarrationEndedAt: null,
    now: at,
    intervalMin: world.hushIntervalMin,
    rng: createSeededRng(42),
    triggerArrived: false,
  });
  next.hush = {
    phase: hush.phase,
    phaseStartedAt: hush.phaseStartedAt,
    nextHushAt: hush.nextHushAt,
    holdEndsAt: hush.holdEndsAt,
    fadeInMs: hush.fadeInMs,
  };
  next.events.push({ type: "hush", phase: hush.phase });

  // Mix ladder
  next.mix = mixLevelFor(
    {
      clockStarving: patch.clockStarving === true,
      batterySaver: patch.batterySaver === true,
      thermal: patch.thermal === true,
    },
    next.mix,
    next.atMs,
  );
  next.events.push({
    type: "mix_level",
    shed: [...shedLayers(next.mix)],
    shedIndex: next.mix.shedIndex,
  });

  // Voice budget sample
  const requests: VoiceRequest[] = [
    { kind: "narration", id: "n1" },
    { kind: "stem", id: "s1" },
    { kind: "stem", id: "s2" },
    { kind: "bed", id: "b1" },
    { kind: "accent", id: "a1" },
    { kind: "beacon", id: "be1" },
    { kind: "moment", id: "m1" },
  ];
  const alloc = allocateVoices(requests, patch.crossfading === true);
  next.events.push({
    type: "voice_budget",
    granted: alloc.granted,
    denied: alloc.denied,
  });

  return next;
}

export function lastEvent<T extends SimEvent["type"]>(
  state: SimulatorHarnessState,
  type: T,
): Extract<SimEvent, { type: T }> | undefined {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i]!;
    if (e.type === type) return e as Extract<SimEvent, { type: T }>;
  }
  return undefined;
}

export function eventsOfType<T extends SimEvent["type"]>(
  state: SimulatorHarnessState,
  type: T,
): Extract<SimEvent, { type: T }>[] {
  return state.events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}

export {
  musicConditionMatches,
  selectMusicCue,
  AFTERGLOW_MS,
  ONESHOT_CONCURRENT_GLOBAL_MAX,
};

export type {
  AmbienceLayerInput,
  AmbienceProfileInput,
  AmbienceZoneInput,
  GeoJsonArea,
  MixLevelState,
  MusicCondition,
  MusicStemInput,
  StoryState,
  TimeWindow,
};

// SimulatorWorld already exported above as type
