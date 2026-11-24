/**
 * Target mix and command diff for the AudioDirector (A6).
 */
import type { AudioRoute, BusId, NowPlayingMeta } from "./AudioEngine";
import type { DirectorCommand } from "./directorTypes";

export const GAIN_EPS_DB = 0.1;

export type TargetBed = {
  id: string;
  sha: string;
  gainDb: number;
  fadeMs: number;
  loopStartMs: number;
  loopEndMs: number;
};

export type TargetAccent = {
  id: string;
  sha: string;
  whenSec: number;
  gainDb: number;
  pan: number;
  rate: number;
};

export type TargetMix = {
  busDb: Record<BusId, number>;
  busRampMs: Record<BusId, number>;
  music: null | {
    cueId: string;
    groupId: string;
    stems: {
      sha: string;
      gainDb: number;
      loopStartMs: number;
      loopEndMs: number;
    }[];
    crossfadeMs: number;
    edgeGain: number;
  };
  beds: TargetBed[];
  accentsPending: TargetAccent[];
  beacon: null | {
    id: string;
    fragmentId: string;
    sha: string;
    gainDb: number;
    pan: number;
    lowpassHz: number;
  };
  narration: null | {
    id: string;
    sha: string;
    startAtMs?: number;
    meta: NowPlayingMeta;
  };
  moment: null | { id: string; sha: string; gainDb: number };
  hushCue: null | { sha: string; gainDb: number; whenSec: number };
  desiredLoaded: string[];
  /** Per-sha decode hints (narration → 24 kHz). */
  decodeHzBySha: Record<string, number>;
  suspended: boolean;
};

export function emptyTargetMix(route: AudioRoute = "headphones"): TargetMix {
  void route;
  return {
    busDb: {
      story: 0,
      music: -8,
      surroundings: -10,
      ui: -6,
      moment: -8,
    },
    busRampMs: {
      story: 0,
      music: 0,
      surroundings: 0,
      ui: 0,
      moment: 0,
    },
    music: null,
    beds: [],
    accentsPending: [],
    beacon: null,
    narration: null,
    moment: null,
    hushCue: null,
    desiredLoaded: [],
    decodeHzBySha: {},
    suspended: false,
  };
}

function gainChanged(a: number, b: number): boolean {
  if (!Number.isFinite(a) && !Number.isFinite(b)) return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  return Math.abs(a - b) > GAIN_EPS_DB;
}

/**
 * Diff previous vs next target into minimal commands.
 * While suspended: no play / start / load; unload and stop allowed; setBusGain deferred.
 */
export function diffMix(
  prev: TargetMix,
  next: TargetMix,
): DirectorCommand[] {
  const commands: DirectorCommand[] = [];
  const suspended = next.suspended;

  if (!prev.suspended && next.suspended) {
    commands.push({ type: "suspend" });
  }
  if (prev.suspended && !next.suspended) {
    commands.push({ type: "resume" });
  }

  // Unloads always allowed
  const prevLoaded = new Set(prev.desiredLoaded);
  const nextLoaded = new Set(next.desiredLoaded);
  for (const sha of prevLoaded) {
    if (!nextLoaded.has(sha)) commands.push({ type: "unload", sha });
  }

  // Stops for layers that disappeared
  if (prev.narration && (!next.narration || prev.narration.id !== next.narration.id)) {
    commands.push({ type: "stop", id: prev.narration.id, fadeMs: 200 });
  }
  if (prev.moment && (!next.moment || prev.moment.id !== next.moment.id)) {
    commands.push({ type: "stop", id: prev.moment.id, fadeMs: 100 });
  }
  if (prev.beacon && (!next.beacon || prev.beacon.id !== next.beacon.id)) {
    commands.push({ type: "stopBeacon", id: prev.beacon.id, fadeMs: 300 });
  }
  if (prev.music && (!next.music || prev.music.groupId !== next.music.groupId)) {
    commands.push({ type: "stop", id: prev.music.groupId, fadeMs: prev.music.crossfadeMs || 500 });
  }
  for (const bed of prev.beds) {
    if (!next.beds.some((b) => b.id === bed.id)) {
      commands.push({ type: "stop", id: bed.id, fadeMs: bed.fadeMs || 500 });
    }
  }
  for (const accent of prev.accentsPending) {
    if (!next.accentsPending.some((a) => a.id === accent.id)) {
      commands.push({ type: "stop", id: accent.id, fadeMs: 50 });
    }
  }

  if (suspended) {
    // Loads / plays / starts / bus gains wait until resume
    return commands;
  }

  for (const sha of nextLoaded) {
    if (!prevLoaded.has(sha)) {
      const decodeHz = next.decodeHzBySha[sha];
      commands.push(
        decodeHz != null
          ? { type: "load", sha, decodeHz }
          : { type: "load", sha },
      );
    }
  }

  for (const bus of Object.keys(next.busDb) as BusId[]) {
    if (gainChanged(prev.busDb[bus], next.busDb[bus])) {
      commands.push({
        type: "setBusGain",
        bus,
        gainDb: next.busDb[bus]!,
        rampMs: next.busRampMs[bus] ?? 0,
      });
    }
  }

  if (next.music) {
    const sameGroup = prev.music?.groupId === next.music.groupId;
    if (!sameGroup) {
      commands.push({
        type: "startLoopGroup",
        id: next.music.groupId,
        bus: "music",
        stems: next.music.stems,
      });
    } else {
      next.music.stems.forEach((stem, index) => {
        const prevStem = prev.music?.stems[index];
        if (!prevStem || gainChanged(prevStem.gainDb, stem.gainDb)) {
          commands.push({
            type: "setStemGain",
            groupId: next.music!.groupId,
            index,
            gainDb: stem.gainDb,
            rampMs: 2000,
          });
        }
      });
    }
  }

  for (const bed of next.beds) {
    const prevBed = prev.beds.find((b) => b.id === bed.id);
    if (!prevBed || prevBed.sha !== bed.sha) {
      commands.push({
        type: "crossfadeBed",
        id: bed.id,
        bus: "surroundings",
        fromId: prevBed ? prevBed.id : null,
        toSha: bed.sha,
        gainDb: bed.gainDb,
        fadeMs: bed.fadeMs,
        loopStartMs: bed.loopStartMs,
        loopEndMs: bed.loopEndMs,
      });
    } else if (gainChanged(prevBed.gainDb, bed.gainDb)) {
      commands.push({
        type: "setBusGain",
        bus: "surroundings",
        gainDb: bed.gainDb,
        rampMs: bed.fadeMs,
      });
    }
  }

  for (const accent of next.accentsPending) {
    if (!prev.accentsPending.some((a) => a.id === accent.id)) {
      commands.push({
        type: "playOneShot",
        id: accent.id,
        sha: accent.sha,
        bus: "surroundings",
        gainDb: accent.gainDb,
        pan: accent.pan,
        rate: accent.rate,
        whenSec: accent.whenSec,
      });
    }
  }

  if (next.beacon) {
    if (!prev.beacon || prev.beacon.id !== next.beacon.id) {
      commands.push({
        type: "startBeacon",
        id: next.beacon.id,
        sha: next.beacon.sha,
        gainDb: next.beacon.gainDb,
        pan: next.beacon.pan,
        lowpassHz: next.beacon.lowpassHz,
      });
    } else if (
      gainChanged(prev.beacon.gainDb, next.beacon.gainDb) ||
      Math.abs(prev.beacon.pan - next.beacon.pan) > 0.01 ||
      prev.beacon.lowpassHz !== next.beacon.lowpassHz
    ) {
      commands.push({
        type: "updateBeacon",
        id: next.beacon.id,
        gainDb: next.beacon.gainDb,
        pan: next.beacon.pan,
        lowpassHz: next.beacon.lowpassHz,
      });
    }
  }

  if (next.narration) {
    if (
      !prev.narration ||
      prev.narration.id !== next.narration.id ||
      prev.narration.startAtMs !== next.narration.startAtMs ||
      prev.narration.sha !== next.narration.sha
    ) {
      commands.push({
        type: "playNarration",
        id: next.narration.id,
        sha: next.narration.sha,
        meta: next.narration.meta,
        startAtMs: next.narration.startAtMs,
      });
    }
  }

  if (next.moment) {
    if (!prev.moment || prev.moment.id !== next.moment.id) {
      commands.push({
        type: "playMoment",
        id: next.moment.id,
        sha: next.moment.sha,
        gainDb: next.moment.gainDb,
      });
    }
  }

  if (next.hushCue && (!prev.hushCue || prev.hushCue.sha !== next.hushCue.sha)) {
    commands.push({
      type: "playOneShot",
      id: `hush-cue:${next.hushCue.sha}`,
      sha: next.hushCue.sha,
      bus: "ui",
      gainDb: next.hushCue.gainDb,
      pan: 0,
      rate: 1,
      whenSec: next.hushCue.whenSec ?? 0,
    });
  }

  return commands;
}
