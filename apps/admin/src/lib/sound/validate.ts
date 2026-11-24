import {
  MUSIC_GROWTH_STEPS_MAX,
  MUSIC_STEMS_PER_CUE_MAX,
  type MusicCondition,
} from "@intell/shared";
import { bedMonoRejectedMessage, growthStepCountHint } from "./helpers";

/** Expected asset_kind for grove sound cue rows. */
export function expectedKindForGroveCue(
  kind: string,
): "beacon" | "music_moment" | null {
  if (
    kind === "beacon_root" ||
    kind === "beacon_branch" ||
    kind === "beacon_leaf"
  ) {
    return "beacon";
  }
  if (kind === "threshold_motif_day" || kind === "threshold_motif_night") {
    return "music_moment";
  }
  return null;
}

/** Resolve assets on music cues must be music_moment. */
export function resolveAssetKindError(
  assetKind: string | null | undefined,
  label: string,
): string | null {
  if (!assetKind) return null;
  if (assetKind !== "music_moment") {
    return `${label} must be asset kind music_moment (got ${assetKind})`;
  }
  return null;
}

export function groveCueAssetKindError(
  cueKind: string,
  assetKind: string,
): string | null {
  const expected = expectedKindForGroveCue(cueKind);
  if (!expected) return `unknown grove cue kind ${cueKind}`;
  if (assetKind !== expected) {
    return `${cueKind} requires asset kind ${expected} (got ${assetKind})`;
  }
  return null;
}

/**
 * Normalize breath/swell ms: sort ascending, unique, require 0 ≤ t ≤ durationMs.
 */
export function normalizeTimingMsList(
  values: readonly number[],
  durationMs: number,
  label: string,
): number[] | { error: string } {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return { error: `${label}: invalid narration duration` };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of sorted) {
    if (!Number.isInteger(t) || t < 0) {
      return { error: `${label}: times must be non-negative integers` };
    }
    if (t > durationMs) {
      return { error: `${label}: ${t} ms exceeds duration ${durationMs} ms` };
    }
    if (out.length && out[out.length - 1] === t) continue; // unique
    out.push(t);
  }
  return out;
}

/** Admin-side condition checks beyond zod (ids + growth + minDepth). */
export function validateMusicConditionAdmin(
  condition: MusicCondition,
  opts: {
    /** Fragment ids that exist (for heardAll / heardAny / notHeard). */
    existingFragmentIds: ReadonlySet<string>;
    /**
     * Length of heardAll for every cue in the same grove+window (including
     * this cue after edit). Used for GROWTH_STEPS_OVER_MAX.
     */
    heardAllLengthsInWindow: readonly number[];
  },
): string | null {
  if (condition.minDepthM !== undefined && condition.minDepthM < 0) {
    return "minDepthM must be ≥ 0";
  }

  const idLists: { key: string; ids: string[] | undefined }[] = [
    { key: "heardAll", ids: condition.heardAll },
    { key: "heardAny", ids: condition.heardAny },
    { key: "notHeard", ids: condition.notHeard },
  ];
  for (const { key, ids } of idLists) {
    if (!ids?.length) continue;
    for (const id of ids) {
      if (!opts.existingFragmentIds.has(id)) {
        return `${key}: fragment ${id} does not exist`;
      }
    }
  }

  const growthHint = growthStepCountHint(opts.heardAllLengthsInWindow);
  if (growthHint.startsWith("GROWTH_STEPS_OVER_MAX")) {
    return growthHint;
  }
  return null;
}

export function validateStemCount(stemCount: number): string | null {
  if (stemCount > MUSIC_STEMS_PER_CUE_MAX) {
    return `STEMS_OVER_MAX: at most ${MUSIC_STEMS_PER_CUE_MAX} stems per cue`;
  }
  return null;
}

/** Refuse mono beds at save (same code as publish BED_MONO). */
export function refuseMonoBed(
  kind: string,
  channels: number,
): string | null {
  if (kind !== "sfx_bed") return null;
  return bedMonoRejectedMessage(channels);
}

export { MUSIC_GROWTH_STEPS_MAX, MUSIC_STEMS_PER_CUE_MAX };
