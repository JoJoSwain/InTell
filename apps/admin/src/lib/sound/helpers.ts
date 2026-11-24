import {
  BED_DURATION_WARN_MS,
  MUSIC_GROWTH_STEPS_MAX,
  MUSIC_STEMS_PER_CUE_MAX,
} from "@intell/shared";
import type { MusicCondition } from "@intell/shared";

/** Inline message when a bed asset is mono (publish failure BED_MONO). */
export function bedMonoRejectedMessage(channels: number): string | null {
  if (channels !== 1) return null;
  return "BED_MONO: ambience beds must be stereo (2 channels)";
}

/** Inline message when a bed exceeds duration warning (BED_LONG). */
export function bedLongWarningMessage(durationMs: number): string | null {
  if (durationMs <= BED_DURATION_WARN_MS) return null;
  return "BED_LONG: bed duration over 2 minutes (publish warning)";
}

/** Validate stem count before save (STEMS_OVER_MAX). */
export function stemsOverMaxMessage(stemCount: number): string | null {
  if (stemCount <= MUSIC_STEMS_PER_CUE_MAX) return null;
  return `STEMS_OVER_MAX: at most ${MUSIC_STEMS_PER_CUE_MAX} stems per cue`;
}

/**
 * Hint for heardAll growth chains in a grove window (GROWTH_STEPS_OVER_MAX).
 * Counts cues in the same grove + time window whose conditions include heardAll.
 */
export function growthStepCountHint(
  heardAllLengths: readonly number[],
): string {
  const withHeardAll = heardAllLengths.filter((n) => n > 0).length;
  if (withHeardAll > MUSIC_GROWTH_STEPS_MAX) {
    return `GROWTH_STEPS_OVER_MAX: ${withHeardAll} growth-step cues (max ${MUSIC_GROWTH_STEPS_MAX})`;
  }
  return `${withHeardAll} of ${MUSIC_GROWTH_STEPS_MAX} growth steps used in this window`;
}

export function parseCommaSeparatedInts(raw: string): number[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new Error(`invalid integer: ${p}`);
    }
    out.push(n);
  }
  return out;
}

export function formatIntArray(values: readonly number[]): string {
  return values.join(", ");
}

export function emptyMusicCondition(): MusicCondition {
  return {};
}

export function parseMusicConditionJson(
  raw: string,
): MusicCondition | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "{}") return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: "conditions must be a JSON object" };
    }
    return parsed as MusicCondition;
  } catch {
    return { error: "conditions must be valid JSON" };
  }
}

/** Validate and normalize a zone boundary Polygon for admin saves. */
export function parsePolygonGeoJson(
  raw: string,
): string | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "boundary GeoJSON required" };
  try {
    const geo = JSON.parse(trimmed) as { type?: string; coordinates?: unknown };
    if (geo.type !== "Polygon" || !Array.isArray(geo.coordinates)) {
      return { error: "boundary must be a GeoJSON Polygon" };
    }
    return JSON.stringify(geo);
  } catch {
    return { error: "boundary must be valid GeoJSON" };
  }
}
