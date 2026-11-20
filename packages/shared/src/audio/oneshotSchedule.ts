import { createSeededRng, type SeededRng } from "./seededRng";

export const ONESHOT_MEAN_INTERVAL_SEC = 8;
export const ONESHOT_HORIZON_SEC = 5 * 60;
export const DEFAULT_ONESHOT_SHAS = [
  "oneshot_1",
  "oneshot_2",
  "oneshot_3",
  "oneshot_4",
  "oneshot_5",
  "oneshot_6",
] as const;

export interface OneShotPlan {
  seq: number;
  /** Absolute AudioContext time (seconds) to call start(when). */
  atSec: number;
  sha: string;
  gainDb: number;
  pan: number;
  rate: number;
}

/**
 * Deterministic one-shot planner for the M1 spike.
 * Advances an internal cursor so fillWindow can top up a rolling horizon.
 */
export class OneShotWindowScheduler {
  private rng: SeededRng;
  private nextAtSec: number | null = null;
  private seq = 0;
  private readonly intervalSec: number;
  private readonly shas: readonly string[];

  constructor(
    seed: number,
    opts?: { intervalSec?: number; shas?: readonly string[] },
  ) {
    this.rng = createSeededRng(seed);
    this.intervalSec = opts?.intervalSec ?? ONESHOT_MEAN_INTERVAL_SEC;
    this.shas = opts?.shas ?? DEFAULT_ONESHOT_SHAS;
  }

  /** Start a new mix: re-seed and schedule the first shot after one interval. */
  reset(seed: number, fromSec: number): void {
    this.rng = createSeededRng(seed);
    this.seq = 0;
    this.nextAtSec = fromSec + this.intervalSec;
  }

  /**
   * Return new plans with atSec in (nowSec, nowSec + horizonSec].
   * Cursor skips over times already in the past without re-rolling (those were
   * scheduled on an earlier fill, or the window lapsed while JS slept).
   */
  fillWindow(nowSec: number, horizonSec: number): OneShotPlan[] {
    if (this.nextAtSec == null) {
      this.nextAtSec = nowSec + this.intervalSec;
    }
    while (this.nextAtSec <= nowSec) {
      this.nextAtSec += this.intervalSec;
    }
    const until = nowSec + horizonSec;
    const out: OneShotPlan[] = [];
    while (this.nextAtSec <= until) {
      out.push(this.makePlan(this.nextAtSec));
      this.nextAtSec += this.intervalSec;
    }
    return out;
  }

  private makePlan(atSec: number): OneShotPlan {
    const sha = this.shas[Math.floor(this.rng() * this.shas.length)] ?? this.shas[0]!;
    const pan = this.rng() * 2 - 1;
    const rate = 0.9 + this.rng() * 0.2;
    const plan: OneShotPlan = {
      seq: this.seq,
      atSec,
      sha,
      gainDb: -12,
      pan,
      rate,
    };
    this.seq += 1;
    return plan;
  }
}
