/**
 * AudioDirector public types (A6). See director.ts for the reducer.
 */
import { z } from "zod";
import type { MusicCueInput, MusicStemInput, StoryState } from "./music";
import type {
  AmbienceLayerInput,
  AmbienceProfileInput,
  AmbienceZoneInput,
  OneShotState,
} from "./ambience";
import type { AudioRoute, BusId, NowPlayingMeta } from "./AudioEngine";
import type { TimeWindow } from "../time/timeWindow";
import type { HushStateMs } from "./hush";
import type { ThresholdMotifState } from "./thresholdMotif";
import type { LockedTeaserState } from "./lockedTeaser";
import type { MixLevelState } from "./mixHealth";
import type { VoiceKind } from "./voices";
import type { TargetMix } from "./directorDiff";
import { emptyTargetMix } from "./directorDiff";
import { initialHushStateMs } from "./hush";
import { initialThresholdMotifState } from "./thresholdMotif";
import { initialLockedTeaserState } from "./lockedTeaser";
import { initialMixLevelState } from "./mixHealth";

/** Director-only accent horizon (do not collide with B·S2 oneshotSchedule). */
export const DIRECTOR_ACCENT_LOOKAHEAD_SEC = 20;
export const DIRECTOR_ACCENT_MAX_PENDING = 2;

export const DIRECTOR_HEARTBEAT_SEC = 5;

export type DirectorMusicCue = MusicCueInput & {
  resolveRootSha?: string;
  resolveBranchSha?: string;
  resolveLeafSha?: string;
};

export type DirectorFragment = {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  tier: "root" | "branch" | "leaf";
  visibility: "standard" | "physical" | "locked";
  title: string;
  beaconSha?: string | null;
  teaserLockedSha?: string | null;
  resolveSha?: string | null;
  breathPointsMs?: number[];
  narrationShaByWindow?: Partial<Record<TimeWindow, string>>;
};

export type DirectorSettings = {
  busGainDb: Record<BusId, number>;
  hushOn: boolean;
  beaconsEnabled: boolean;
  /** Product asset TBD — director treats as no-op (A6 review G7). */
  chimeOn: boolean;
  route: AudioRoute;
  batterySaver: boolean;
  thermal: boolean;
};

export type DirectorWorld = {
  groveId: string;
  timeZone: string;
  allowsSpeakerWildlife: boolean;
  hushIntervalMin: number;
  depthBloomTextureM: number;
  fragments: DirectorFragment[];
  musicCues: DirectorMusicCue[];
  ambienceZones: AmbienceZoneInput[];
  ambienceProfiles: AmbienceProfileInput[];
  classToProfile: ReadonlyMap<string, string>;
  landcoverCells: readonly (string | null)[];
  motifDaySha?: string | null;
  motifNightSha?: string | null;
  groveBeaconByTier: Partial<Record<"root" | "branch" | "leaf", string>>;
  hushListenSha?: string | null;
  engineCaps: {
    canStreamBeds: boolean;
    narrationDecodeHz: number;
  };
};

export type PendingAccent = {
  id: string;
  layerId: string;
  sha: string;
  whenSec: number;
  gainDb: number;
  pan: number;
  rate: number;
};

export type DirectorState = {
  v: 1;
  rngSeed: number;
  rngCursor: number;
  audioClockSec: number;
  wallAtMs: number;
  suspended: boolean;
  resumePointMs: number | null;
  afterglowEndsAtMs: number | null;
  pendingGrowthCueId: string | null;
  currentCueId: string | null;
  cueStartedAtMs: number | null;
  depthBloomInside: boolean;
  bufferTiers: ("root" | "branch" | "leaf")[];
  hush: HushStateMs;
  motif: ThresholdMotifState;
  teaser: LockedTeaserState;
  mix: MixLevelState;
  oneshotByLayerId: Record<string, OneShotState>;
  pendingAccents: PendingAccent[];
  accentSeq: number;
  activeVoiceIds: string[];
  currentBeaconId: string | null;
  lastBeaconPan: number;
  lastOneShotAtSec: number | null;
  failedShas: string[];
  point: { lat: number; lng: number };
  courseDeg: number | null;
  depthM: number | undefined;
  month: number;
  timeWindow: TimeWindow;
  insideGrove: boolean;
  story: StoryState;
  queuedFragment: boolean;
  lastNarrationEndedAtMs: number | null;
  triggerArrived: boolean;
  resolvePlay: { id: string; sha: string } | null;
  motifPlay: { id: string; sha: string } | null;
  teaserPlay: { id: string; sha: string } | null;
  hushPlayCue: boolean;
  bedByLayerId: Record<string, { sha: string; gainDb: number; fadeMs: number }>;
  recentBedShas: Record<string, string[]>;
  narration: {
    playing: boolean;
    fragmentId: string | null;
    sha: string | null;
    startedAtSec: number | null;
    endsAtSec: number | null;
    positionMs: number;
    breathPointsMs: number[];
    meta: NowPlayingMeta | null;
  };
  crossfading: boolean;
  /** Last health signal; heartbeats reuse it so shed windows accumulate. */
  clockStarving: boolean;
  loadedShas: string[];
  lastEmitted: TargetMix;
  settings: DirectorSettings;
};

export type DirectorSessionEffect =
  | {
      type: "play";
      fragmentId: string;
      revisionNo: number;
      sha?: string;
      title?: string;
      breathPointsMs?: number[];
      durationMs?: number;
      startAtMs?: number;
    }
  | { type: "stopNarration" }
  | {
      type: "startAfterglow";
      endsAt: number;
      fragmentId: string;
      tier: "root" | "branch" | "leaf";
    }
  | { type: "groveEntered"; groveId: string }
  | {
      type: "showTeaser";
      fragmentId: string;
      reason: "locked" | "wrongTime";
    }
  | { type: "sessionEnded"; sessionId: string; at: number };

type ClockFields = { audioSec: number; wallAtMs: number };

export type DirectorInput =
  | ({ type: "heartbeat" } & ClockFields)
  | ({ type: "story"; story: StoryState } & ClockFields)
  | ({
      type: "location";
      point: { lat: number; lng: number };
      courseDeg: number | null;
      depthM: number | undefined;
      month: number;
      timeWindow: TimeWindow;
      insideGrove: boolean;
    } & ClockFields)
  | ({ type: "settings"; settings: Partial<DirectorSettings> } & ClockFields)
  | ({ type: "sessionEffect"; effect: DirectorSessionEffect } & ClockFields)
  | ({
      type: "voiceEnded";
      voiceId: string;
      kind: VoiceKind;
    } & ClockFields)
  | ({
      type: "narrationProgress";
      positionMs: number;
      durationMs: number;
    } & ClockFields)
  | ({
      type: "interruption";
      phase: "began" | "ended";
      shouldResume?: boolean;
    } & ClockFields)
  | ({ type: "health"; clockStarving: boolean } & ClockFields)
  | ({ type: "assetFailed"; sha: string } & ClockFields);

export type DirectorCommand =
  | { type: "load"; sha: string; decodeHz?: number }
  | { type: "unload"; sha: string }
  | {
      type: "startLoopGroup";
      id: string;
      bus: BusId;
      stems: {
        sha: string;
        gainDb: number;
        loopStartMs: number;
        loopEndMs: number;
      }[];
    }
  | {
      type: "crossfadeBed";
      id: string;
      bus: BusId;
      fromId: string | null;
      toSha: string;
      gainDb: number;
      fadeMs: number;
      loopStartMs: number;
      loopEndMs: number;
    }
  | {
      type: "setStemGain";
      groupId: string;
      index: number;
      gainDb: number;
      rampMs: number;
    }
  | { type: "setBusGain"; bus: BusId; gainDb: number; rampMs: number }
  | {
      type: "playOneShot";
      id: string;
      sha: string;
      bus: BusId;
      gainDb: number;
      pan: number;
      rate: number;
      whenSec: number;
    }
  | { type: "playMoment"; id: string; sha: string; gainDb: number }
  | {
      type: "playNarration";
      id: string;
      sha: string;
      meta: NowPlayingMeta;
      startAtMs?: number;
    }
  | {
      type: "startBeacon";
      id: string;
      sha: string;
      gainDb: number;
      pan: number;
      lowpassHz: number;
    }
  | {
      type: "updateBeacon";
      id: string;
      gainDb: number;
      pan: number;
      lowpassHz: number;
    }
  | { type: "stopBeacon"; id: string; fadeMs: number }
  | { type: "stop"; id: string; fadeMs: number }
  | { type: "suspend" }
  | { type: "resume" };

export function defaultDirectorSettings(
  route: AudioRoute = "headphones",
): DirectorSettings {
  return {
    busGainDb: { story: 0, music: 0, surroundings: 0, ui: 0, moment: 0 },
    hushOn: true,
    beaconsEnabled: true,
    chimeOn: false,
    route,
    batterySaver: false,
    thermal: false,
  };
}

export function emptyStory(timeWindow: TimeWindow = "day"): StoryState {
  return {
    playingThreadIds: [],
    lastThreadIds: [],
    heard: new Set(),
    timeWindow,
    narrationPlaying: false,
    insideTierBuffers: [],
  };
}

export function initialDirectorState(opts: {
  seed: number;
  wallAtMs: number;
  dayKey: string;
  point?: { lat: number; lng: number };
  settings?: Partial<DirectorSettings>;
}): DirectorState {
  const settings = {
    ...defaultDirectorSettings(),
    ...opts.settings,
  };
  return {
    v: 1,
    rngSeed: opts.seed >>> 0,
    rngCursor: 0,
    audioClockSec: 0,
    wallAtMs: opts.wallAtMs,
    suspended: false,
    resumePointMs: null,
    afterglowEndsAtMs: null,
    pendingGrowthCueId: null,
    currentCueId: null,
    cueStartedAtMs: null,
    depthBloomInside: false,
    bufferTiers: [],
    hush: initialHushStateMs(),
    motif: initialThresholdMotifState(),
    teaser: initialLockedTeaserState(opts.dayKey),
    mix: initialMixLevelState(),
    oneshotByLayerId: {},
    pendingAccents: [],
    accentSeq: 0,
    activeVoiceIds: [],
    currentBeaconId: null,
    lastBeaconPan: 0,
    lastOneShotAtSec: null,
    failedShas: [],
    point: opts.point ?? { lat: 0, lng: 0 },
    courseDeg: null,
    depthM: undefined,
    month: 6,
    timeWindow: "day",
    insideGrove: false,
    story: emptyStory("day"),
    queuedFragment: false,
    lastNarrationEndedAtMs: null,
    triggerArrived: false,
    resolvePlay: null,
    motifPlay: null,
    teaserPlay: null,
    hushPlayCue: false,
    bedByLayerId: {},
    recentBedShas: {},
    narration: {
      playing: false,
      fragmentId: null,
      sha: null,
      startedAtSec: null,
      endsAtSec: null,
      positionMs: 0,
      breathPointsMs: [],
      meta: null,
    },
    crossfading: false,
    clockStarving: false,
    loadedShas: [],
    lastEmitted: emptyTargetMix(settings.route),
    settings,
  };
}

const BusDbSchema = z.object({
  story: z.number(),
  music: z.number(),
  surroundings: z.number(),
  ui: z.number(),
  moment: z.number(),
});

const TargetMixSchema = z.object({
  busDb: BusDbSchema,
  busRampMs: BusDbSchema,
  music: z
    .object({
      cueId: z.string(),
      groupId: z.string(),
      stems: z.array(
        z.object({
          sha: z.string(),
          gainDb: z.number(),
          loopStartMs: z.number(),
          loopEndMs: z.number(),
        }),
      ),
      crossfadeMs: z.number(),
      edgeGain: z.number(),
    })
    .nullable(),
  beds: z.array(
    z.object({
      id: z.string(),
      sha: z.string(),
      gainDb: z.number(),
      fadeMs: z.number(),
      loopStartMs: z.number(),
      loopEndMs: z.number(),
    }),
  ),
  accentsPending: z.array(
    z.object({
      id: z.string(),
      sha: z.string(),
      whenSec: z.number(),
      gainDb: z.number(),
      pan: z.number(),
      rate: z.number(),
    }),
  ),
  beacon: z
    .object({
      id: z.string(),
      fragmentId: z.string(),
      sha: z.string(),
      gainDb: z.number(),
      pan: z.number(),
      lowpassHz: z.number(),
    })
    .nullable(),
  narration: z
    .object({
      id: z.string(),
      sha: z.string(),
      startAtMs: z.number().optional(),
      meta: z.object({
        title: z.string(),
        artist: z.string(),
        artworkUri: z.string().optional(),
      }),
    })
    .nullable(),
  moment: z
    .object({ id: z.string(), sha: z.string(), gainDb: z.number() })
    .nullable(),
  hushCue: z
    .object({
      sha: z.string(),
      gainDb: z.number(),
      whenSec: z.number(),
    })
    .nullable(),
  desiredLoaded: z.array(z.string()),
  decodeHzBySha: z.record(z.number()),
  suspended: z.boolean(),
});

const DirectorStateSchema = z.object({
  v: z.literal(1),
  rngSeed: z.number(),
  rngCursor: z.number(),
  audioClockSec: z.number(),
  wallAtMs: z.number(),
  suspended: z.boolean(),
  resumePointMs: z.number().nullable(),
  afterglowEndsAtMs: z.number().nullable(),
  pendingGrowthCueId: z.string().nullable(),
  currentCueId: z.string().nullable(),
  cueStartedAtMs: z.number().nullable(),
  depthBloomInside: z.boolean(),
  bufferTiers: z.array(z.enum(["root", "branch", "leaf"])),
  hush: z.object({
    phase: z.enum(["idle", "fadingOut", "cue", "holding", "fadingIn"]),
    phaseStartedAt: z.number().nullable(),
    nextHushAt: z.number().nullable(),
    holdEndsAt: z.number().nullable(),
    fadeInMs: z.number(),
  }),
  motif: z.object({
    played: z.boolean(),
    waitingSinceAt: z.number().nullable(),
    pendingSha: z.string().nullable(),
  }),
  teaser: z.object({
    dayKey: z.string(),
    playedFragmentIds: z.array(z.string()),
  }),
  mix: z.object({
    shedIndex: z.number(),
    degradedWindows: z.number(),
    healthySinceAt: z.number().nullable(),
  }),
  oneshotByLayerId: z.record(
    z.object({ nextAtSec: z.number().nullable() }),
  ),
  pendingAccents: z.array(
    z.object({
      id: z.string(),
      layerId: z.string(),
      sha: z.string(),
      whenSec: z.number(),
      gainDb: z.number(),
      pan: z.number(),
      rate: z.number(),
    }),
  ),
  accentSeq: z.number(),
  activeVoiceIds: z.array(z.string()),
  currentBeaconId: z.string().nullable(),
  lastBeaconPan: z.number(),
  lastOneShotAtSec: z.number().nullable(),
  failedShas: z.array(z.string()),
  point: z.object({ lat: z.number(), lng: z.number() }),
  courseDeg: z.number().nullable(),
  depthM: z.number().optional(),
  month: z.number(),
  timeWindow: z.enum(["day", "night"]),
  insideGrove: z.boolean(),
  story: z.object({
    groveId: z.string().optional(),
    playingFragmentId: z.string().optional(),
    playingTier: z.enum(["root", "branch", "leaf"]).optional(),
    playingThreadIds: z.array(z.string()),
    lastFragmentId: z.string().optional(),
    lastTier: z.enum(["root", "branch", "leaf"]).optional(),
    lastThreadIds: z.array(z.string()),
    heard: z.array(z.string()),
    timeWindow: z.enum(["day", "night"]),
    narrationPlaying: z.boolean(),
    depthM: z.number().optional(),
    insideTierBuffers: z.array(z.enum(["root", "branch", "leaf"])),
  }),
  queuedFragment: z.boolean(),
  lastNarrationEndedAtMs: z.number().nullable(),
  triggerArrived: z.boolean(),
  resolvePlay: z
    .object({ id: z.string(), sha: z.string() })
    .nullable(),
  motifPlay: z.object({ id: z.string(), sha: z.string() }).nullable(),
  teaserPlay: z.object({ id: z.string(), sha: z.string() }).nullable(),
  hushPlayCue: z.boolean(),
  bedByLayerId: z.record(
    z.object({ sha: z.string(), gainDb: z.number(), fadeMs: z.number() }),
  ),
  recentBedShas: z.record(z.array(z.string())),
  narration: z.object({
    playing: z.boolean(),
    fragmentId: z.string().nullable(),
    sha: z.string().nullable(),
    startedAtSec: z.number().nullable(),
    endsAtSec: z.number().nullable(),
    positionMs: z.number(),
    breathPointsMs: z.array(z.number()),
    meta: z
      .object({
        title: z.string(),
        artist: z.string(),
        artworkUri: z.string().optional(),
      })
      .nullable(),
  }),
  crossfading: z.boolean(),
  clockStarving: z.boolean(),
  loadedShas: z.array(z.string()),
  lastEmitted: TargetMixSchema,
  settings: z.object({
    busGainDb: BusDbSchema,
    hushOn: z.boolean(),
    beaconsEnabled: z.boolean(),
    chimeOn: z.boolean(),
    route: z.enum(["headphones", "bluetooth", "speaker", "unknown"]),
    batterySaver: z.boolean(),
    thermal: z.boolean(),
  }),
});

export function parseDirectorState(raw: unknown): DirectorState {
  const parsed = DirectorStateSchema.parse(raw);
  return {
    ...parsed,
    depthM: parsed.depthM,
    story: {
      ...parsed.story,
      heard: new Set(parsed.story.heard),
    },
    lastEmitted: parsed.lastEmitted as TargetMix,
  };
}

export function serializeDirectorState(state: DirectorState): unknown {
  return {
    ...state,
    story: {
      ...state.story,
      heard: [...state.story.heard],
    },
  };
}

export type { MusicStemInput, AmbienceLayerInput };
