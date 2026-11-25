import {
  distanceInsideMeters,
  pointInPolygon,
  type GeoJsonArea,
} from "../geo/polygon";
import type { MusicCondition, StemRulePack } from "../schemas/music";
import type { TimeWindow } from "../time/timeWindow";

/**
 * Edge fade for a cue on the grove boundary, or on a grove-pack zone that
 * has no fade of its own (AUDIO_SPEC §4.3). The caller puts this on `edgeFadeM`.
 */
export const GROVE_MUSIC_EDGE_FADE_M = 60;

export type StoryState = {
  groveId?: string;
  playingFragmentId?: string;
  playingTier?: "root" | "branch" | "leaf";
  playingThreadIds: string[];
  lastFragmentId?: string;
  lastTier?: "root" | "branch" | "leaf";
  lastThreadIds: string[];
  /** Fragment ids completed for their latest contingency. */
  heard: ReadonlySet<string>;
  timeWindow: TimeWindow;
  narrationPlaying: boolean;
  /** Absent until the first fix — depth conditions then do not match. */
  depthM?: number;
  /** Serializable latched buffer membership (not a Set). */
  insideTierBuffers: ("root" | "branch" | "leaf")[];
};

/** Plan name for `StoryState`. */
export type MusicStoryState = StoryState;

export type MusicStemInput = {
  assetSha: string;
  gainDb: number;
  stateGains: StemRulePack[];
};

export type MusicCueInput = {
  id: string;
  timeWindow: TimeWindow;
  priority: number;
  conditions: MusicCondition;
  minDwellS: number;
  crossfadeMs: number;
  boundary: GeoJsonArea;
  edgeFadeM: number;
  stems: MusicStemInput[];
};

function hasItems(ids: readonly string[] | undefined): ids is readonly string[] {
  return ids !== undefined && ids.length > 0;
}

/** AND of the keys that are present. An empty array matches, like a missing key. */
export function musicConditionMatches(
  condition: MusicCondition,
  story: StoryState,
): boolean {
  // Device parsers set this when a condition carried unknown keys (A7b).
  if (condition.neverMatch === true) return false;

  if (hasItems(condition.threadIds)) {
    const threads = story.narrationPlaying
      ? [...story.lastThreadIds, ...story.playingThreadIds]
      : story.lastThreadIds;
    if (!condition.threadIds.some((id) => threads.includes(id))) return false;
  }

  if (hasItems(condition.tiers)) {
    const tier = story.narrationPlaying ? story.playingTier : story.lastTier;
    if (tier === undefined || !condition.tiers.includes(tier)) return false;
  }

  if (hasItems(condition.heardAll) && !condition.heardAll.every((id) => story.heard.has(id))) {
    return false;
  }
  if (hasItems(condition.heardAny) && !condition.heardAny.some((id) => story.heard.has(id))) {
    return false;
  }
  if (hasItems(condition.notHeard) && condition.notHeard.some((id) => story.heard.has(id))) {
    return false;
  }

  if (
    condition.narrationPlaying !== undefined &&
    condition.narrationPlaying !== story.narrationPlaying
  ) {
    return false;
  }

  if (condition.minDepthM !== undefined) {
    if (story.depthM === undefined || story.depthM < condition.minDepthM) {
      return false;
    }
  }
  if (condition.insideTierBuffer !== undefined) {
    if (!story.insideTierBuffers.includes(condition.insideTierBuffer)) {
      return false;
    }
  }
  return true;
}

/**
 * Like selectMusicCue, but defers a growth-step change (heardAll-driven cue
 * upgrade) until afterglow ends.
 */
export function selectMusicCueDeferred(
  input: Parameters<typeof selectMusicCue>[0] & {
    pendingGrowthCueId: string | null;
    afterglowEndsAt: number | null;
    at: number;
  },
): ReturnType<typeof selectMusicCue> {
  const base = selectMusicCue(input);
  if (
    input.pendingGrowthCueId &&
    input.afterglowEndsAt !== null &&
    input.at < input.afterglowEndsAt
  ) {
    const current = input.current
      ? input.cues.find((c) => c.id === input.current?.cueId)
      : undefined;
    if (current) {
      const distanceM = distanceInsideMeters(input.point, current.boundary);
      return {
        cue: current,
        edgeGain: edgeGainFor(distanceM, current.edgeFadeM),
        crossfadeMs: 0,
      };
    }
  }
  return base;
}

function edgeGainFor(distanceM: number, edgeFadeM: number): number {
  if (edgeFadeM <= 0) return 1;
  return Math.min(1, Math.max(0, distanceM / edgeFadeM));
}

function silence(
  cues: readonly MusicCueInput[],
  current: { cueId: string; startedAt: Date } | null,
): { cue: null; edgeGain: 0; crossfadeMs: number } {
  const outgoing = current ? cues.find((cue) => cue.id === current.cueId) : undefined;
  return { cue: null, edgeGain: 0, crossfadeMs: outgoing?.crossfadeMs ?? 0 };
}

/**
 * Highest-priority cue whose window, polygon and conditions match.
 * Before `minDwellS`, the current cue stays against anything.
 * After dwell, only a strictly higher priority replaces it.
 * A change crossfades over the incoming cue. Silence uses the outgoing cue.
 */
export function selectMusicCue(input: {
  cues: readonly MusicCueInput[];
  point: { lat: number; lng: number };
  story: StoryState;
  current: { cueId: string; startedAt: Date } | null;
  now: Date;
}): { cue: MusicCueInput | null; edgeGain: number; crossfadeMs: number } {
  const candidates = input.cues
    .filter(
      (cue) =>
        cue.timeWindow === input.story.timeWindow &&
        pointInPolygon(input.point, cue.boundary) &&
        musicConditionMatches(cue.conditions, input.story),
    )
    .sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const best = candidates[0];
  if (!best) return silence(input.cues, input.current);

  const currentCue = input.current
    ? candidates.find((cue) => cue.id === input.current?.cueId)
    : undefined;
  let selected = best;
  if (currentCue && input.current) {
    const elapsedS = (input.now.getTime() - input.current.startedAt.getTime()) / 1000;
    if (elapsedS < currentCue.minDwellS || currentCue.priority === best.priority) {
      selected = currentCue;
    }
  }

  const distanceM = distanceInsideMeters(input.point, selected.boundary);
  const changed = selected.id !== input.current?.cueId;
  return {
    cue: selected,
    edgeGain: edgeGainFor(distanceM, selected.edgeFadeM),
    crossfadeMs: changed ? selected.crossfadeMs : 0,
  };
}

/** Resting `gainDb`, or the first matching rule's level in its place. */
export function stemGainDb(stem: MusicStemInput, story: StoryState): number {
  for (const rule of stem.stateGains) {
    if (musicConditionMatches(rule.when, story)) return rule.gainDb;
  }
  return stem.gainDb;
}
