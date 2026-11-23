import { distanceInsideMeters, pointInPolygon, type GeoJsonPolygon } from "../geo/polygon";
import type { SeededRng } from "./seededRng";
import type { TimeWindow } from "../time/timeWindow";

export type AmbienceLayerInput = {
  id: string;
  kind: "bed" | "oneshot";
  timeWindow: TimeWindow;
  months: number[];
  wildlifeCall: boolean;
  nestingMuteMonths: number[];
  speakerSafe: boolean;
  gainDbMin: number;
  gainDbMax: number;
  panMin: number;
  panMax: number;
  pitchCentsMin: number;
  pitchCentsMax: number;
  noRepeatLast: number;
  crossfadeMs: number;
  meanIntervalS?: number;
  minIntervalS?: number;
  maxConcurrent?: number;
  assets: { sha: string; weight: number }[];
};

export type AmbienceProfileInput = {
  slug: string;
  density: number;
  layers: readonly AmbienceLayerInput[];
};

export type AmbienceZoneInput = {
  id: string;
  boundary: GeoJsonPolygon;
  profileSlug: string;
  priority: number;
  edgeFadeM: number;
};

export type ActiveProfile = { profileSlug: string; weight: number };

/** `gainDb + 20·log10(weight)`. Weight 0 is silence. */
export function scaleGainDb(gainDb: number, weight: number): number {
  if (weight <= 0) return Number.NEGATIVE_INFINITY;
  if (weight === 1) return gainDb;
  return gainDb + 20 * Math.log10(weight);
}

function zoneWeight(distanceM: number, edgeFadeM: number): number {
  if (edgeFadeM <= 0) return 1;
  return Math.min(1, Math.max(0, distanceM / edgeFadeM));
}

/**
 * Majority class of the center cell and its neighbors.
 * Null cells are ignored. A tie goes to the center when it is tied,
 * otherwise to the tied class that appears first.
 */
export function landcoverClass(cells: readonly (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const cell of cells) {
    if (cell == null) continue;
    counts.set(cell, (counts.get(cell) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let best = 0;
  for (const count of counts.values()) best = Math.max(best, count);
  const tied = new Set(
    [...counts.entries()].filter(([, count]) => count === best).map(([code]) => code),
  );

  const center = cells[0];
  if (center != null && tied.has(center)) return center;
  for (const cell of cells) {
    if (cell != null && tied.has(cell)) return cell;
  }
  return null;
}

function mergeProfiles(entries: readonly ActiveProfile[]): ActiveProfile[] {
  const merged: ActiveProfile[] = [];
  for (const entry of entries) {
    if (entry.weight <= 0) continue;
    const existing = merged.find((item) => item.profileSlug === entry.profileSlug);
    if (existing) existing.weight += entry.weight;
    else merged.push({ ...entry });
  }
  return merged;
}

/**
 * At most two profiles, weights summing to 1 when both a zone and a fallback exist.
 * Same profile slugs merge. The second zone does not apply its own edge weight.
 */
export function activeProfiles(input: {
  zones: readonly AmbienceZoneInput[];
  point: { lat: number; lng: number };
  /** Center cell first, then up to six neighbors. Null where the grid has no data. */
  landcoverCells: readonly (string | null)[];
  classToProfile: ReadonlyMap<string, string>;
}): ActiveProfile[] {
  const containing = input.zones
    .filter((zone) => pointInPolygon(input.point, zone.boundary))
    .map((zone) => ({
      zone,
      weight: zoneWeight(distanceInsideMeters(input.point, zone.boundary), zone.edgeFadeM),
    }))
    .sort(
      (a, b) =>
        b.zone.priority - a.zone.priority ||
        (a.zone.id < b.zone.id ? -1 : a.zone.id > b.zone.id ? 1 : 0),
    );

  const code = landcoverClass(input.landcoverCells);
  const landcoverSlug = code == null ? undefined : input.classToProfile.get(code);

  const top = containing[0];
  if (!top) {
    return landcoverSlug ? [{ profileSlug: landcoverSlug, weight: 1 }] : [];
  }

  const entries: ActiveProfile[] = [{ profileSlug: top.zone.profileSlug, weight: top.weight }];
  if (top.weight < 1) {
    const next = containing[1];
    const rest = 1 - top.weight;
    if (next) entries.push({ profileSlug: next.zone.profileSlug, weight: rest });
    else if (landcoverSlug) entries.push({ profileSlug: landcoverSlug, weight: rest });
  }
  return mergeProfiles(entries);
}

export function eligibleLayers(input: {
  profile: AmbienceProfileInput;
  timeWindow: TimeWindow;
  month: number;
  route: "speaker" | "headphones";
  /** True when any grove containing the listener has allowsSpeakerWildlifeSounds false. */
  muteAllSurroundingsOnSpeaker: boolean;
  hushActive: boolean;
}): AmbienceLayerInput[] {
  if (input.hushActive) return [];
  if (input.route === "speaker" && input.muteAllSurroundingsOnSpeaker) return [];

  return input.profile.layers.filter((layer) => {
    if (layer.timeWindow !== input.timeWindow) return false;
    if (!layer.months.includes(input.month)) return false;
    if (layer.wildlifeCall && layer.nestingMuteMonths.includes(input.month)) return false;
    if (input.route === "speaker" && (layer.wildlifeCall || !layer.speakerSafe)) return false;
    return true;
  });
}

function weightedPick(
  assets: readonly { sha: string; weight: number }[],
  rng: SeededRng,
): { sha: string; weight: number } | null {
  if (assets.length === 0) return null;
  if (assets.length === 1) return assets[0] ?? null;
  const total = assets.reduce((sum, asset) => sum + asset.weight, 0);
  if (total <= 0) return assets[0] ?? null;
  let cursor = rng() * total;
  for (const asset of assets) {
    cursor -= asset.weight;
    if (cursor < 0) return asset;
  }
  return assets[assets.length - 1] ?? null;
}

function candidatesAvoiding(
  assets: readonly { sha: string; weight: number }[],
  recentShas: readonly string[],
  noRepeatLast: number,
): { sha: string; weight: number }[] {
  const recent = new Set(recentShas.slice(-Math.max(0, noRepeatLast)));
  const fresh = assets.filter((asset) => !recent.has(asset.sha));
  return fresh.length > 0 ? fresh : [...assets];
}

function uniform(rng: SeededRng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function pickBed(input: {
  layer: AmbienceLayerInput;
  profileWeight: number;
  recentShas: readonly string[];
  rng: SeededRng;
}): { sha: string; gainDb: number } | null {
  const pool = candidatesAvoiding(input.layer.assets, input.recentShas, input.layer.noRepeatLast);
  const picked = weightedPick(pool, input.rng);
  if (!picked) return null;
  const gainDb = uniform(input.rng, input.layer.gainDbMin, input.layer.gainDbMax);
  return { sha: picked.sha, gainDb: scaleGainDb(gainDb, input.profileWeight) };
}

export type OneShotState = { nextAtSec: number | null };

export type OneShotEvent = {
  sha: string;
  atSec: number;
  gainDb: number;
  pan: number;
  rate: number;
};

const NARRATION_ONESHOT_GAP_S = 4;
const NARRATION_GUARD_S = 1.5;

function exponentialDelay(
  rng: SeededRng,
  meanS: number,
  minS: number,
  density: number,
  weight: number,
): number {
  const scale = density * weight;
  if (!(scale > 0) || !(meanS > 0)) return minS;
  const expo = -Math.log(1 - rng()) * (meanS / scale);
  return Math.max(minS, expo);
}

/**
 * Schedules one layer's next one-shot. Draws only when it sets `nextAtSec`
 * or when a due shot is played. A shot blocked by `maxConcurrent`, the
 * narration cap, or the silence guard is dropped, and the next gap is drawn
 * from this tick.
 */
export function nextOneShot(input: {
  layer: AmbienceLayerInput;
  profileWeight: number;
  density: number;
  nowSec: number;
  recentShas: readonly string[];
  concurrent: number;
  narrationPlaying: boolean;
  narrationStartedAtSec: number | null;
  narrationEndsAtSec: number | null;
  lastOneShotAtSec: number | null;
  state: OneShotState;
  rng: SeededRng;
}): { state: OneShotState; shot: OneShotEvent | null } {
  const meanS = input.layer.meanIntervalS;
  if (meanS == null || input.layer.assets.length === 0) {
    return { state: input.state, shot: null };
  }
  const minS = input.layer.minIntervalS ?? 0;
  const delay = () =>
    exponentialDelay(input.rng, meanS, minS, input.density, input.profileWeight);

  if (input.state.nextAtSec == null) {
    return { state: { nextAtSec: input.nowSec + delay() }, shot: null };
  }
  if (input.nowSec < input.state.nextAtSec) {
    return { state: input.state, shot: null };
  }

  const maxConcurrent = input.layer.maxConcurrent ?? Number.POSITIVE_INFINITY;
  const inStartGuard =
    input.narrationStartedAtSec != null &&
    input.nowSec < input.narrationStartedAtSec + NARRATION_GUARD_S;
  const inEndGuard =
    input.narrationEndsAtSec != null &&
    input.nowSec > input.narrationEndsAtSec - NARRATION_GUARD_S;
  const tooSoon =
    input.lastOneShotAtSec != null &&
    input.nowSec - input.lastOneShotAtSec < NARRATION_ONESHOT_GAP_S;
  const blocked =
    input.concurrent >= maxConcurrent ||
    (input.narrationPlaying && (inStartGuard || inEndGuard || tooSoon));

  if (blocked) {
    return { state: { nextAtSec: input.nowSec + delay() }, shot: null };
  }

  const pool = candidatesAvoiding(input.layer.assets, input.recentShas, input.layer.noRepeatLast);
  const picked = weightedPick(pool, input.rng);
  if (!picked) return { state: { nextAtSec: input.nowSec + delay() }, shot: null };

  const shot: OneShotEvent = {
    sha: picked.sha,
    atSec: input.nowSec,
    gainDb: uniform(input.rng, input.layer.gainDbMin, input.layer.gainDbMax),
    pan: uniform(input.rng, input.layer.panMin, input.layer.panMax),
    rate: 2 ** (uniform(input.rng, input.layer.pitchCentsMin, input.layer.pitchCentsMax) / 1200),
  };
  return { state: { nextAtSec: input.nowSec + delay() }, shot };
}
