/**
 * Listening Simulator harness — drives shared `directorStep` (A6).
 * Same public surface as A5 so harness tests and the UI stay stable.
 */
import {
  AFTERGLOW_MS,
  ONESHOT_CONCURRENT_GLOBAL_MAX,
  accentAllowed,
  activeProfiles,
  allocateVoices,
  directorStep,
  distanceMeters,
  eligibleLayers,
  initialDirectorState,
  localDayKey,
  musicConditionMatches,
  selectMusicCue,
  shedLayers,
  stemGainDb,
  type AmbienceLayerInput,
  type AmbienceProfileInput,
  type AmbienceZoneInput,
  type AudioRoute,
  type DirectorCommand,
  type DirectorState,
  type DirectorWorld,
  type GeoJsonArea,
  type MixLevelState,
  type MusicCondition,
  type MusicStemInput,
  type StoryState,
  type TimeWindow,
} from "@intell/shared";

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

export type SimMusicCue = {
  id: string;
  name: string;
  timeWindow: TimeWindow;
  priority: number;
  conditions: MusicCondition;
  minDwellS: number;
  crossfadeMs: number;
  boundary: GeoJsonArea;
  edgeFadeM: number;
  stems: MusicStemInput[];
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
  | { type: "gpx_tick"; tMs: number; lat: number; lng: number; speed: 1 | 4 }
  | { type: "director_commands"; commands: DirectorCommand[] };

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

export type SimulatorHarnessState = {
  lat: number;
  lng: number;
  atMs: number;
  month: number;
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
  hush: {
    phase: string;
    phaseStartedAt: Date | null;
    nextHushAt: Date | null;
    holdEndsAt: Date | null;
    fadeInMs: number;
  };
  motif: DirectorState["motif"];
  teaser: DirectorState["teaser"];
  mix: MixLevelState;
  activeOneshots: number;
  currentCueId: string | null;
  cueStartedAt: number | null;
  depthBloomInside: boolean;
  bufferTiers: ("root" | "branch" | "leaf")[];
  currentBeaconId: string | null;
  lastBeaconPan: number;
  timeZone: string;
  events: SimEvent[];
  director: DirectorState;
  lastCommands: DirectorCommand[];
};

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

function toDirectorWorld(world: SimulatorWorld): DirectorWorld {
  return {
    groveId: world.groveId,
    timeZone: "America/Denver",
    allowsSpeakerWildlife: world.allowsSpeakerWildlife,
    hushIntervalMin: world.hushIntervalMin,
    depthBloomTextureM: world.depthBloomTextureM,
    fragments: world.fragments.map((f) => ({
      id: f.id,
      lat: f.lat,
      lng: f.lng,
      radiusM: f.radiusM,
      tier: f.tier,
      visibility: f.visibility,
      title: f.title,
      beaconSha: f.beaconAssetSha,
      teaserLockedSha: f.teaserLockedSha,
      resolveSha: f.resolveAssetSha,
    })),
    musicCues: world.cues.map((c) => ({
      id: c.id,
      timeWindow: c.timeWindow,
      priority: c.priority,
      conditions: c.conditions,
      minDwellS: c.minDwellS,
      crossfadeMs: c.crossfadeMs,
      boundary: c.boundary,
      edgeFadeM: c.edgeFadeM,
      stems: c.stems,
      resolveRootSha: c.resolveRootSha,
      resolveBranchSha: c.resolveBranchSha,
      resolveLeafSha: c.resolveLeafSha,
    })),
    ambienceZones: world.ambienceZones,
    ambienceProfiles: world.profiles,
    classToProfile: world.classToProfile,
    landcoverCells: world.landcoverCells,
    motifDaySha: world.motifDaySha,
    motifNightSha: world.motifNightSha,
    groveBeaconByTier: {},
    hushListenSha: "hush-listen-sha",
    engineCaps: {
      canStreamBeds: false,
      narrationDecodeHz: 24_000,
    },
  };
}

function mirrorFromDirector(
  harness: SimulatorHarnessState,
  d: DirectorState,
  commands: DirectorCommand[],
  events: SimEvent[],
): SimulatorHarnessState {
  return {
    ...harness,
    director: d,
    lastCommands: commands,
    atMs: d.wallAtMs,
    lat: d.point.lat,
    lng: d.point.lng,
    depthM: d.depthM ?? harness.depthM,
    month: d.month,
    route: d.settings.route,
    beaconsEnabled: d.settings.beaconsEnabled,
    narrationPlaying: d.narration.playing,
    narrationPositionMs: d.narration.positionMs,
    breathPointsMs: [...d.narration.breathPointsMs],
    afterglowEndsAt: d.afterglowEndsAtMs,
    pendingGrowthCueId: d.pendingGrowthCueId,
    hush: {
      phase: d.hush.phase,
      phaseStartedAt:
        d.hush.phaseStartedAt != null ? new Date(d.hush.phaseStartedAt) : null,
      nextHushAt: d.hush.nextHushAt != null ? new Date(d.hush.nextHushAt) : null,
      holdEndsAt: d.hush.holdEndsAt != null ? new Date(d.hush.holdEndsAt) : null,
      fadeInMs: d.hush.fadeInMs,
    },
    motif: d.motif,
    teaser: d.teaser,
    mix: d.mix,
    currentCueId: d.currentCueId,
    cueStartedAt: d.cueStartedAtMs,
    depthBloomInside: d.depthBloomInside,
    bufferTiers: [...d.bufferTiers],
    currentBeaconId: d.currentBeaconId,
    lastBeaconPan: d.lastBeaconPan,
    completed: new Set(d.story.heard),
    activeOneshots: d.pendingAccents.length,
    events,
  };
}

function storyHeard(completed: Set<string>, window: TimeWindow): StoryState {
  return {
    playingThreadIds: [],
    lastThreadIds: [],
    heard: completed,
    timeWindow: window,
    narrationPlaying: false,
    insideTierBuffers: [],
  };
}

export function createHarnessState(
  origin: { lat: number; lng: number },
  atMs: number,
  opts?: { timeZone?: string; dayKey?: string; seed?: number },
): SimulatorHarnessState {
  const timeZone = opts?.timeZone ?? "America/Denver";
  const dayKey = opts?.dayKey ?? localDayKey(new Date(atMs), timeZone);
  const director = initialDirectorState({
    seed: opts?.seed ?? 42,
    wallAtMs: atMs,
    dayKey,
    point: origin,
    settings: { route: "headphones", beaconsEnabled: true, hushOn: true },
  });
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
    hush: {
      phase: "idle",
      phaseStartedAt: null,
      nextHushAt: null,
      holdEndsAt: null,
      fadeInMs: director.hush.fadeInMs,
    },
    motif: director.motif,
    teaser: director.teaser,
    mix: director.mix,
    activeOneshots: 0,
    currentCueId: null,
    cueStartedAt: null,
    depthBloomInside: false,
    bufferTiers: [],
    currentBeaconId: null,
    lastBeaconPan: 0,
    timeZone,
    events: [],
    director,
    lastCommands: [],
  };
}

export function simulatorTick(
  state: SimulatorHarnessState,
  world: SimulatorWorld,
  patch: SimulatorTickPatch = {},
): SimulatorHarnessState {
  const dWorld = toDirectorWorld(world);
  let director = state.director;
  const events: SimEvent[] = [...state.events];
  let allCommands: DirectorCommand[] = [];

  const atMs = patch.atMs ?? state.atMs;
  const audioClockSec =
    state.director.audioClockSec + Math.max(0, (atMs - state.atMs) / 1000);

  const lat = patch.lat ?? state.lat;
  const lng = patch.lng ?? state.lng;
  const month = patch.month ?? state.month;
  const forcedWindow =
    patch.forcedWindow !== undefined ? patch.forcedWindow : state.forcedWindow;
  const window: TimeWindow = forcedWindow ?? "day";
  const route = patch.route ?? state.route;
  const beaconsEnabled = patch.beaconsEnabled ?? state.beaconsEnabled;
  const depthM = patch.depthM ?? state.depthM;

  const completed = new Set(state.completed);
  // When ending narration with a completion, apply afterglow before the new
  // heard id reaches music select — otherwise growth skips deferral.
  const deferCompletionForAfterglow =
    patch.endNarration === true && patch.completeFragmentId != null;
  if (patch.completeFragmentId && !deferCompletionForAfterglow) {
    completed.add(patch.completeFragmentId);
  }

  if (patch.gpx) {
    events.push({
      type: "gpx_tick",
      tMs: patch.gpx.tMs,
      lat,
      lng,
      speed: patch.gpx.speed,
    });
  }

  const clocks = { audioSec: audioClockSec, wallAtMs: atMs };

  // Settings
  {
    const r = directorStep(
      director,
      {
        type: "settings",
        settings: {
          route,
          beaconsEnabled,
          batterySaver: patch.batterySaver === true,
          thermal: patch.thermal === true,
        },
        ...clocks,
      },
      dWorld,
    );
    director = r.state;
    allCommands = allCommands.concat(r.commands);
  }

  // Story (heard set) — completed toggles are the Simulator's source of truth
  {
    const story = storyHeard(completed, window);
    story.depthM = depthM;
    story.narrationPlaying =
      patch.narrationPlaying ?? state.narrationPlaying;
    story.insideTierBuffers = [...director.bufferTiers];
    if (completed.size > 0) {
      const last = [...completed].at(-1)!;
      const frag = world.fragments.find((f) => f.id === last);
      story.lastFragmentId = last;
      if (frag) story.lastTier = frag.tier;
    }
    const r = directorStep(
      director,
      { type: "story", story, ...clocks },
      dWorld,
    );
    director = r.state;
    allCommands = allCommands.concat(r.commands);
  }

  // Location
  {
    const insideGrove = world.fragments.some(
      (f) => distanceMeters({ lat, lng }, f) <= 200,
    );
    const r = directorStep(
      director,
      {
        type: "location",
        point: { lat, lng },
        courseDeg: 0,
        depthM,
        month,
        timeWindow: window,
        insideGrove,
        ...clocks,
      },
      dWorld,
    );
    director = r.state;
    allCommands = allCommands.concat(r.commands);
  }

  // Session effects from patches
  if (patch.enterGrove) {
    const r = directorStep(
      director,
      {
        type: "sessionEffect",
        effect: { type: "groveEntered", groveId: world.groveId },
        ...clocks,
      },
      dWorld,
    );
    director = r.state;
    allCommands = allCommands.concat(r.commands);
    const motifCmd = r.commands.find((c) => c.type === "playMoment");
    if (motifCmd && motifCmd.type === "playMoment") {
      events.push({ type: "motif", playSha: motifCmd.sha });
    } else if (director.motifPlay) {
      events.push({ type: "motif", playSha: director.motifPlay.sha });
    } else {
      events.push({ type: "motif" });
    }
  }

  if (patch.startNarration || patch.narrationPlaying === true) {
    const r = directorStep(
      director,
      {
        type: "sessionEffect",
        effect: {
          type: "play",
          fragmentId: "sim-narration",
          revisionNo: 1,
          breathPointsMs: patch.breathPointsMs ?? state.breathPointsMs,
          startAtMs: patch.narrationPositionMs ?? state.narrationPositionMs,
        },
        ...clocks,
      },
      dWorld,
    );
    director = r.state;
    allCommands = allCommands.concat(r.commands);
  }

  if (patch.narrationPositionMs != null || patch.breathPointsMs) {
    director = {
      ...director,
      narration: {
        ...director.narration,
        positionMs: patch.narrationPositionMs ?? director.narration.positionMs,
        breathPointsMs: patch.breathPointsMs
          ? [...patch.breathPointsMs]
          : director.narration.breathPointsMs,
      },
    };
  }

  if (patch.endNarration) {
    const completedId =
      patch.completeFragmentId ?? [...completed].at(-1) ?? "unknown";
    if (patch.completeFragmentId) completed.add(patch.completeFragmentId);
    const frag = world.fragments.find((f) => f.id === completedId);
    const tier = frag?.tier ?? "root";
    const r = directorStep(
      director,
      {
        type: "sessionEffect",
        effect: {
          type: "startAfterglow",
          endsAt: atMs + AFTERGLOW_MS,
          fragmentId: completedId,
          tier,
        },
        ...clocks,
      },
      dWorld,
    );
    director = r.state;
    allCommands = allCommands.concat(r.commands);

    const resolveCmd = r.commands.find((c) => c.type === "playMoment");
    if (resolveCmd && resolveCmd.type === "playMoment") {
      events.push({
        type: "resolve",
        kind: "asset",
        detail: resolveCmd.sha,
      });
    } else if (director.resolvePlay) {
      events.push({
        type: "resolve",
        kind: "asset",
        detail: director.resolvePlay.sha,
      });
    } else {
      events.push({
        type: "resolve",
        kind: "pause",
        detail: `pause:${AFTERGLOW_MS}`,
      });
    }

    const motifCmd = r.commands.find(
      (c) =>
        c.type === "playMoment" &&
        resolveCmd &&
        c.type === "playMoment" &&
        c.id !== resolveCmd.id,
    );
    void motifCmd;
  }

  if (patch.lockedTeaserTap) {
    const r = directorStep(
      director,
      {
        type: "sessionEffect",
        effect: {
          type: "showTeaser",
          fragmentId: patch.lockedTeaserTap.fragmentId,
          reason:
            world.fragments.find((f) => f.id === patch.lockedTeaserTap!.fragmentId)
              ?.visibility === "locked"
              ? "locked"
              : "wrongTime",
        },
        ...clocks,
      },
      dWorld,
    );
    director = r.state;
    allCommands = allCommands.concat(r.commands);
    const teaser = r.commands.find(
      (c) => c.type === "playOneShot" && c.bus === "story",
    );
    events.push({
      type: "locked_teaser",
      playSha:
        teaser && teaser.type === "playOneShot" ? teaser.sha : undefined,
    });
  }

  if (
    patch.clockStarving != null ||
    patch.batterySaver != null ||
    patch.thermal != null
  ) {
    const r = directorStep(
      director,
      {
        type: "health",
        clockStarving: patch.clockStarving === true,
        ...clocks,
      },
      dWorld,
    );
    director = r.state;
    allCommands = allCommands.concat(r.commands);
  } else if (director.clockStarving) {
    // Keep shedding windows accumulating across ticks that omit the flag
    // only when previously starving — clear when patch explicitly false.
  }

  if (patch.clockStarving === false) {
    const r = directorStep(
      director,
      { type: "health", clockStarving: false, ...clocks },
      dWorld,
    );
    director = r.state;
    allCommands = allCommands.concat(r.commands);
  }

  // Heartbeat evaluate
  {
    const r = directorStep(
      director,
      { type: "heartbeat", ...clocks },
      dWorld,
    );
    director = r.state;
    allCommands = allCommands.concat(r.commands);
  }

  // Crossfading patch
  if (patch.crossfading != null) {
    director = { ...director, crossfading: patch.crossfading };
  }

  // Oneshot cap bookkeeping for rail (patch-driven, matches A5 tests)
  let activeOneshots = state.activeOneshots;
  let oneshotDenied = false;
  if (patch.oneshotEnded && activeOneshots > 0) activeOneshots -= 1;
  if (patch.oneshotRequest) {
    if (activeOneshots >= ONESHOT_CONCURRENT_GLOBAL_MAX) oneshotDenied = true;
    else activeOneshots += 1;
  }

  // Accent breath check (explicit patch)
  if (patch.checkAccent && (patch.narrationPlaying ?? director.narration.playing)) {
    const pos = patch.narrationPositionMs ?? director.narration.positionMs;
    const breaths = patch.breathPointsMs ?? director.narration.breathPointsMs;
    if (!accentAllowed(pos, breaths)) {
      events.push({ type: "accent_blocked_breath" });
    }
  }

  // Emit rail events from director state
  events.push({ type: "time_window", window });

  // Profile weights / layers — rail readout (same rules the director used)
  const weights = activeProfiles({
    zones: world.ambienceZones,
    point: { lat, lng },
    landcoverCells: world.landcoverCells,
    classToProfile: world.classToProfile,
  });
  events.push({ type: "profile_weights", weights });

  const routeForLayers: "speaker" | "headphones" =
    route === "speaker" ? "speaker" : "headphones";
  const hushActive =
    director.hush.phase === "fadingOut" ||
    director.hush.phase === "cue" ||
    director.hush.phase === "holding";
  const layerIds: string[] = [];
  let wildlifeSilenced = false;
  for (const w of weights) {
    const profile = world.profiles.find((p) => p.slug === w.profileSlug);
    if (!profile) continue;
    const layers = eligibleLayers({
      profile,
      timeWindow: window,
      month,
      route: routeForLayers,
      muteAllSurroundingsOnSpeaker: !world.allowsSpeakerWildlife,
      hushActive,
    });
    for (const layer of layers) layerIds.push(layer.id);
  }
  if (routeForLayers === "speaker" && !world.allowsSpeakerWildlife) {
    wildlifeSilenced = true;
  }
  if (
    routeForLayers === "speaker" &&
    world.profiles.some((p) =>
      p.layers.some((l) => l.wildlifeCall || !l.speakerSafe),
    )
  ) {
    wildlifeSilenced = true;
  }
  events.push({ type: "eligible_layers", layerIds });
  events.push({ type: "wildlife_silenced", silenced: wildlifeSilenced });

  events.push({
    type: "depth_bloom",
    inside: director.depthBloomInside,
    depthM: director.depthM ?? depthM,
  });
  events.push({ type: "buffer", tiers: [...director.bufferTiers] });
  events.push({
    type: "oneshot_cap",
    active: activeOneshots,
    denied: oneshotDenied,
  });

  const afterglowActive =
    director.pendingGrowthCueId != null &&
    director.afterglowEndsAtMs != null &&
    atMs < director.afterglowEndsAtMs;

  events.push({
    type: "music_cue",
    cueId: director.currentCueId,
    deferred: afterglowActive,
  });

  const cue = world.cues.find((c) => c.id === director.currentCueId);
  if (cue) {
    cue.stems.forEach((stem, i) => {
      const story: StoryState = {
        ...director.story,
        heard: completed,
        timeWindow: window,
        narrationPlaying: director.narration.playing,
        depthM: director.depthM,
        insideTierBuffers: director.bufferTiers,
      };
      events.push({
        type: "stem_gain",
        stemIndex: i,
        gainDb: stemGainDb(stem, story),
      });
    });
  }

  const beacon = director.lastEmitted.beacon;
  if (beacon) {
    events.push({
      type: "beacon",
      fragmentId: beacon.fragmentId,
      pan: beacon.pan,
      gainDb: beacon.gainDb,
    });
  } else {
    events.push({
      type: "beacon",
      fragmentId: null,
      pan: director.lastBeaconPan,
      gainDb: Number.NEGATIVE_INFINITY,
    });
  }

  // Motif without enterGrove already handled; emit empty motif tick for enterGrove path only
  if (!patch.enterGrove && director.motifPlay) {
    const already = events.some(
      (e) => e.type === "motif" && e.playSha === director.motifPlay?.sha,
    );
    if (!already) {
      events.push({ type: "motif", playSha: director.motifPlay.sha });
    }
  }

  events.push({ type: "hush", phase: director.hush.phase });

  events.push({
    type: "mix_level",
    shed: [...shedLayers(director.mix)],
    shedIndex: director.mix.shedIndex,
  });

  const requests = [
    { kind: "narration" as const, id: "n1" },
    { kind: "stem" as const, id: "s1" },
    { kind: "stem" as const, id: "s2" },
    { kind: "bed" as const, id: "b1" },
    { kind: "accent" as const, id: "a1" },
    { kind: "beacon" as const, id: "be1" },
    { kind: "moment" as const, id: "m1" },
  ];
  const alloc = allocateVoices(requests, patch.crossfading === true);
  events.push({
    type: "voice_budget",
    granted: alloc.granted,
    denied: alloc.denied,
  });

  events.push({ type: "director_commands", commands: allCommands });

  const mirrored = mirrorFromDirector(
    {
      ...state,
      forcedWindow,
      activeOneshots,
      completed,
    },
    director,
    allCommands,
    events,
  );
  return mirrored;
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
  return state.events.filter(
    (e): e is Extract<SimEvent, { type: T }> => e.type === type,
  );
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
