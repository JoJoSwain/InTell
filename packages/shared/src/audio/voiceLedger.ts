export type VoiceKind =
  | "narration"
  | "oneshot"
  | "bed"
  | "stem"
  | "heartbeat";

export interface VoiceEntry {
  readonly kind: VoiceKind;
  /** AudioContext time when playback started; null until markStarted. */
  startSec: number | null;
  /** Expected end time on the audio clock, or null if unknown. */
  expectedEndSec: number | null;
  released: boolean;
}

export interface VoiceLedgerStats {
  created: number;
  released: number;
  missedEnded: number;
  live: number;
}

/**
 * Pure bookkeeping for engine voices. Tracks create / start / release and
 * supports sweep helpers without touching the audio library.
 */
export class VoiceLedger {
  private readonly entries = new Map<string, VoiceEntry>();
  private created = 0;
  private released = 0;
  private missedEnded = 0;

  create(id: string, kind: VoiceKind, expectedEndSec: number | null): void {
    if (this.entries.has(id)) {
      throw new Error(`VoiceLedger: duplicate create for id ${id}`);
    }
    this.entries.set(id, {
      kind,
      startSec: null,
      expectedEndSec,
      released: false,
    });
    this.created += 1;
  }

  markStarted(id: string, startSec: number): void {
    const entry = this.requireLive(id);
    entry.startSec = startSec;
  }

  setExpectedEnd(id: string, endSec: number): void {
    const entry = this.requireLive(id);
    entry.expectedEndSec = endSec;
  }

  /** Idempotent: no-op if the voice was already released. */
  markReleased(id: string): boolean {
    const entry = this.entries.get(id);
    if (entry == null || entry.released) {
      return false;
    }
    entry.released = true;
    this.released += 1;
    return true;
  }

  /**
   * Caller should invoke markReleased for each id, then increment missedEnded
   * once per id released via sweep (not for natural onEnded releases).
   */
  releaseIfPast(nowSec: number, graceSec = 0.5): string[] {
    const out: string[] = [];
    for (const [id, entry] of this.entries) {
      if (entry.released) {
        continue;
      }
      const end = entry.expectedEndSec;
      if (end != null && end + graceSec < nowSec) {
        out.push(id);
      }
    }
    return out;
  }

  recordMissedEnded(count = 1): void {
    if (count > 0) {
      this.missedEnded += count;
    }
  }

  liveCount(excludeHeartbeats = false): number {
    let n = 0;
    for (const entry of this.entries.values()) {
      if (!entry.released) {
        if (excludeHeartbeats && entry.kind === "heartbeat") {
          continue;
        }
        n += 1;
      }
    }
    return n;
  }

  /**
   * One-shots that are not released and whose start is still in the future
   * relative to nowSec (pending schedule, not yet started on the clock).
   */
  pendingOneShotCount(nowSec: number): number {
    let n = 0;
    for (const entry of this.entries.values()) {
      if (entry.released || entry.kind !== "oneshot") {
        continue;
      }
      const start = entry.startSec;
      if (start == null) {
        // Created but not started: treat as pending if we have a future expected window.
        const end = entry.expectedEndSec;
        if (end != null && end > nowSec) {
          n += 1;
        }
        continue;
      }
      if (start > nowSec) {
        n += 1;
      }
    }
    return n;
  }

  /** Live voices plus pending one-shots, for AUDIO_SPEC §2.1 budget checks. */
  liveOrPendingSources(nowSec: number, excludeHeartbeats = true): number {
    let n = 0;
    for (const entry of this.entries.values()) {
      if (entry.released) {
        continue;
      }
      if (excludeHeartbeats && entry.kind === "heartbeat") {
        continue;
      }
      if (entry.kind === "oneshot") {
        const start = entry.startSec;
        if (start != null && start > nowSec) {
          n += 1;
          continue;
        }
        if (start == null && entry.expectedEndSec != null && entry.expectedEndSec > nowSec) {
          n += 1;
          continue;
        }
      }
      n += 1;
    }
    return n;
  }

  getStats(): VoiceLedgerStats {
    return {
      created: this.created,
      released: this.released,
      missedEnded: this.missedEnded,
      live: this.liveCount(false),
    };
  }

  assertBalanced(): void {
    const { created, released, live } = this.getStats();
    if (created !== released + live) {
      throw new Error(
        `VoiceLedger unbalanced: created=${created} released=${released} live=${live}`,
      );
    }
  }

  private requireLive(id: string): VoiceEntry {
    const entry = this.entries.get(id);
    if (entry == null) {
      throw new Error(`VoiceLedger: unknown id ${id}`);
    }
    if (entry.released) {
      throw new Error(`VoiceLedger: id ${id} is already released`);
    }
    return entry;
  }
}