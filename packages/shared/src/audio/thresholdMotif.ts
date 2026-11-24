import type { TimeWindow } from "../time/timeWindow";
import {
  THRESHOLD_MOTIF_DEPTH_M,
  THRESHOLD_MOTIF_WAIT_MS,
} from "./soundFeatures";

/** Serializable motif state for one exploring session. */
export type ThresholdMotifState = {
  played: boolean;
  waitingSinceAt: number | null;
  pendingSha: string | null;
};

export function initialThresholdMotifState(): ThresholdMotifState {
  return { played: false, waitingSinceAt: null, pendingSha: null };
}

export type ThresholdMotifEvent =
  | {
      type: "groveEntered";
      at: number;
      depthM: number;
      timeWindow: TimeWindow;
      motifDaySha?: string;
      motifNightSha?: string;
    }
  | { type: "fix"; at: number; depthM: number }
  | { type: "narrationStarted"; at: number }
  | { type: "narrationEnded"; at: number }
  | { type: "tick"; at: number; narrationPlaying: boolean; depthM: number };

/**
 * Once per visit: play motif when depth ≥ 10 m; wait up to 30 s if narration
 * blocks, then drop.
 */
export function thresholdMotifStep(
  state: ThresholdMotifState,
  event: ThresholdMotifEvent,
): { state: ThresholdMotifState; playSha?: string } {
  if (state.played) return { state };

  let next = { ...state };

  if (event.type === "groveEntered") {
    const sha =
      event.timeWindow === "day" ? event.motifDaySha : event.motifNightSha;
    if (!sha) return { state: next };
    next = { ...next, pendingSha: sha };
    if (event.depthM >= THRESHOLD_MOTIF_DEPTH_M) {
      return tryPlay(next, event.at, false);
    }
    return { state: next };
  }

  if (event.type === "fix" || event.type === "tick") {
    const narration =
      event.type === "tick" ? event.narrationPlaying : false;
    if (event.depthM < THRESHOLD_MOTIF_DEPTH_M) return { state: next };
    return tryPlay(next, event.at, narration);
  }

  if (event.type === "narrationStarted") {
    if (next.pendingSha && next.waitingSinceAt === null) {
      next = { ...next, waitingSinceAt: event.at };
    }
    return { state: next };
  }

  if (event.type === "narrationEnded") {
    return tryPlay(next, event.at, false);
  }

  return { state: next };
}

function tryPlay(
  state: ThresholdMotifState,
  at: number,
  narrationPlaying: boolean,
): { state: ThresholdMotifState; playSha?: string } {
  if (!state.pendingSha || state.played) return { state };

  if (narrationPlaying) {
    const waitingSince = state.waitingSinceAt ?? at;
    if (at - waitingSince >= THRESHOLD_MOTIF_WAIT_MS) {
      return {
        state: {
          played: true,
          waitingSinceAt: null,
          pendingSha: null,
        },
      };
    }
    return {
      state: { ...state, waitingSinceAt: waitingSince },
    };
  }

  return {
    state: { played: true, waitingSinceAt: null, pendingSha: null },
    playSha: state.pendingSha,
  };
}
