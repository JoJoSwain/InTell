/**
 * Exploring session reducer (A4 / TECH_SPEC §3.2).
 *
 * Pure: no clocks, timers, I/O or randomness. Time arrives on each event (`at`).
 * State is JSON-serializable for kv persistence (`parseSessionState`).
 *
 * `recentFixes` may hold coordinates: local device state only — never send them
 * off the device and never put them into an effect.
 *
 * ## Public surface (for M6)
 * - `sessionStep(state, event, world)` → `{ state, effects }`
 * - `storyStateOf(state, world)` → AUDIO_SPEC §4.1 `StoryState` (Hush stays in `hush.ts`)
 * - `initialSessionState` / `parseSessionState` for resume
 * - Constants: `AFTERGLOW_MS`, `OUTSIDE_END_MS`, `SESSION_MAX_MS`, `LOCATION_HIGH_WITHIN_M`
 *
 * ## Effect order (natural narration end)
 * `recordCompletion` → `writeUnlocks` → `metCharacters` → `analytics fragment_completed`
 * → `startAfterglow` (and `growthMoment` when it applies — M9 Journal hook; not emitted yet).
 *
 * ## Settings / window events
 * `settingsChanged` merges its `accessibleTrigger` and `locationAvailable` into
 * `world.settings` for that step (so a lagging shell still gets the right
 * `setLocationMode`). From the next event onward the shell must pass the
 * updated `world`. `windowChanged` already uses `event.timeWindow` for the queue.
 *
 * Lane B (M6) wires location, audio and SQLite to these effects.
 */

import { z } from "zod";
import { AFTERGLOW_MS } from "../audio/DuckingPolicy";
import type { StoryState } from "../audio/music";
import {
  distanceInsideMeters,
  distanceMeters,
  pointInPolygon,
  type GeoJsonMultiPolygon,
  type LatLng,
} from "../geo/polygon";
import type { TimeWindow } from "../time/timeWindow";
import {
  ACCESSIBLE_RADIUS_M,
  chooseTrigger,
  proximityCandidates,
  queueAfterTrigger,
  scanDecision,
  TWO_FIX_WINDOW_MS,
  type LocationFix,
  type QueuedFragment,
  type TriggerVia,
} from "./trigger";
import {
  completedEpoch,
  heardOlderEpoch,
  isPlayableNow,
  isUnlocked,
  pickVersion,
  unlocksToWrite,
  type CompletionRow,
  type ExternalPrerequisite,
  type FragmentInput,
  type UnlockRow,
  type VersionRef,
} from "./unlock";

/** Re-export the shared afterglow constant (also used by DuckingPolicy). */
export { AFTERGLOW_MS };
export const OUTSIDE_END_MS = 15 * 60_000;
export const SESSION_MAX_MS = 3 * 60 * 60_000;
export const LOCATION_HIGH_WITHIN_M = 150;
export const SESSION_STATE_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type PlayingRef = {
  fragmentId: string;
  revisionNo: number;
  version: VersionRef;
  via: TriggerVia;
  startedAt: number;
  /** Epoch ms when pause began; null when playing. */
  pausedAt: number | null;
  /** Accumulated pause duration before the current pause. */
  pausedTotalMs: number;
};

export type SessionState = {
  v: typeof SESSION_STATE_VERSION;
  phase: "idle" | "exploring";
  sessionId: string | null;
  startedAt: number | null;
  groveIds: string[];
  /** Deepest containing grove on the latest fix (ties: lower id). */
  currentGroveId: string | null;
  /**
   * Groves that have been `currentGroveId` this session (for `groveEntered`).
   */
  enteredCurrentGroveIds: string[];
  playing: PlayingRef | null;
  queued: QueuedFragment | null;
  afterglowEndsAt: number | null;
  lastInsideGroveAt: number | null;
  fragmentsCompletedThisSession: string[];
  /** Counts per grove for writeVisit. */
  completionsByGrove: Record<string, number>;
  lastCompletedFragmentId: string | null;
  recentFixes: { at: number; lat: number; lng: number; accuracyM: number }[];
};

const VersionRefSchema = z
  .object({
    lang: z.string(),
    timeWindow: z.enum(["day", "night"]),
  })
  .strict();

const QueuedSchema = z
  .object({
    fragmentId: z.string(),
    via: z.enum(["proximity", "accessible", "scan"]),
  })
  .strict();

const PlayingSchema = z
  .object({
    fragmentId: z.string(),
    revisionNo: z.number().int(),
    version: VersionRefSchema,
    via: z.enum(["proximity", "accessible", "scan"]),
    startedAt: z.number(),
    pausedAt: z.number().nullable(),
    pausedTotalMs: z.number().nonnegative(),
  })
  .strict();

const SessionStateSchema = z
  .object({
    v: z.literal(1),
    phase: z.enum(["idle", "exploring"]),
    sessionId: z.string().nullable(),
    startedAt: z.number().nullable(),
    groveIds: z.array(z.string()),
    currentGroveId: z.string().nullable(),
    enteredCurrentGroveIds: z.array(z.string()),
    playing: PlayingSchema.nullable(),
    queued: QueuedSchema.nullable(),
    afterglowEndsAt: z.number().nullable(),
    lastInsideGroveAt: z.number().nullable(),
    fragmentsCompletedThisSession: z.array(z.string()),
    completionsByGrove: z.record(z.string(), z.number().int().nonnegative()),
    lastCompletedFragmentId: z.string().nullable(),
    recentFixes: z.array(
      z
        .object({
          at: z.number(),
          lat: z.number(),
          lng: z.number(),
          accuracyM: z.number(),
        })
        .strict(),
    ),
  })
  .strict();

export function initialSessionState(): SessionState {
  return {
    v: SESSION_STATE_VERSION,
    phase: "idle",
    sessionId: null,
    startedAt: null,
    groveIds: [],
    currentGroveId: null,
    enteredCurrentGroveIds: [],
    playing: null,
    queued: null,
    afterglowEndsAt: null,
    lastInsideGroveAt: null,
    fragmentsCompletedThisSession: [],
    completionsByGrove: {},
    lastCompletedFragmentId: null,
    recentFixes: [],
  };
}

/** Rejects unknown versions. */
export function parseSessionState(raw: unknown): SessionState {
  return SessionStateSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// World / events / effects
// ---------------------------------------------------------------------------

export type SessionFragmentMeta = {
  revisionNo: number;
  teaser?: string;
  changeTeaser?: string;
  characterIds?: string[];
};

export type SessionWorld = {
  groves: readonly { id: string; boundary: GeoJsonMultiPolygon }[];
  fragments: readonly FragmentInput[];
  fragmentMeta: Readonly<Record<string, SessionFragmentMeta>>;
  externalPrerequisites: readonly ExternalPrerequisite[];
  markers: Readonly<Record<string, string>>;
  completions: readonly CompletionRow[];
  unlocks: readonly UnlockRow[];
  timeWindow: TimeWindow;
  lang: string;
  settings: {
    accessibleTrigger: boolean;
    locationAvailable: boolean;
    /** Required; tests use 25. No silent production default. */
    accuracyToleranceM: number;
  };
};

export type SessionEvent =
  | {
      type: "fix";
      at: number;
      lat: number;
      lng: number;
      accuracyM: number;
      sessionId?: string;
    }
  | {
      type: "scan";
      at: number;
      markerHash: string;
      sessionId?: string;
    }
  | {
      type: "narrationEnded";
      at: number;
      reason: "natural" | "stopped" | "interrupted";
      playedMs: number;
    }
  | { type: "narrationPaused"; at: number }
  | { type: "narrationResumed"; at: number }
  | { type: "afterglowElapsed"; at: number }
  | { type: "tick"; at: number }
  | { type: "stop"; at: number }
  | {
      type: "settingsChanged";
      at: number;
      accessibleTrigger: boolean;
      locationAvailable: boolean;
    }
  | { type: "windowChanged"; at: number; timeWindow: TimeWindow };

export type SessionEffect =
  | { type: "sessionStarted"; sessionId: string; at: number }
  | { type: "sessionEnded"; sessionId: string; at: number }
  | { type: "groveEntered"; groveId: string }
  | {
      type: "setLocationMode";
      mode: "idle" | "foreground" | "balanced" | "high";
    }
  | {
      type: "play";
      fragmentId: string;
      revisionNo: number;
      version: VersionRef;
      via: TriggerVia;
      changeTeaser?: string;
    }
  | { type: "stopNarration" }
  | {
      type: "showTeaser";
      fragmentId: string;
      reason: "locked" | "wrongTime";
      changeTeaser?: string;
    }
  | {
      type: "recordCompletion";
      fragmentId: string;
      revisionNo: number;
      timeWindow: TimeWindow;
      onSite: true;
      trigger: TriggerVia;
      sessionId: string;
    }
  | {
      type: "recordProgress";
      fragmentId: string;
      revisionNo: number;
      timeWindow: TimeWindow;
      maxProgressMs: number;
    }
  | { type: "writeUnlocks"; fragmentIds: string[] }
  | { type: "metCharacters"; characterIds: string[]; fragmentId: string }
  | {
      type: "writeVisit";
      sessionId: string;
      startedAt: number;
      endedAt: number;
      timeWindow: TimeWindow;
      groves: { groveId: string; fragmentsCompleted: number }[];
    }
  | {
      type: "startAfterglow";
      endsAt: number;
      fragmentId: string;
      tier: "root" | "branch" | "leaf";
    }
  | {
      type: "analytics";
      name:
        | "grove_entered"
        | "session_started"
        | "fragment_completed"
        | "session_ended";
      props: Record<string, string | number | boolean>;
    }
  | { type: "growthMoment"; fragmentId: string; revisionNo: number };

export type { StoryState };

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** at − startedAt − pausedTotalMs (− current pause if still paused). */
export function computedPlayedMs(playing: PlayingRef, at: number): number {
  const pausedExtra =
    playing.pausedAt !== null ? Math.max(0, at - playing.pausedAt) : 0;
  return Math.max(
    0,
    at - playing.startedAt - playing.pausedTotalMs - pausedExtra,
  );
}

function fragmentById(
  world: SessionWorld,
  id: string,
): FragmentInput | undefined {
  return world.fragments.find((f) => f.id === id);
}

function metaOf(world: SessionWorld, id: string): SessionFragmentMeta {
  return world.fragmentMeta[id] ?? { revisionNo: 1 };
}

function unlockedIds(world: SessionWorld): Set<string> {
  const set = new Set<string>();
  for (const f of world.fragments) {
    if (
      isUnlocked(
        f,
        world.fragments,
        world.externalPrerequisites,
        world.completions,
        world.unlocks,
      ).unlocked
    ) {
      set.add(f.id);
    }
  }
  return set;
}

function completedEpochIds(world: SessionWorld): Set<string> {
  const set = new Set<string>();
  for (const f of world.fragments) {
    if (completedEpoch(f, world.completions)) set.add(f.id);
  }
  return set;
}

function isEligibleId(world: SessionWorld, fragmentId: string): boolean {
  const f = fragmentById(world, fragmentId);
  if (!f || f.retired) return false;
  return isPlayableNow(
    f,
    world.fragments,
    world.externalPrerequisites,
    world.completions,
    world.unlocks,
    world.timeWindow,
    world.lang,
  );
}

function stillInRange(
  world: SessionWorld,
  state: SessionState,
  fragmentId: string,
): boolean {
  const f = fragmentById(world, fragmentId);
  const last = state.recentFixes[state.recentFixes.length - 1];
  if (!f || !last) return false;
  const point = { lat: last.lat, lng: last.lng };
  if (f.visibility === "physical") return true;
  const radiusM = f.radiusM;
  if (radiusM === undefined) return false;
  const r = world.settings.accessibleTrigger
    ? Math.max(radiusM, ACCESSIBLE_RADIUS_M)
    : radiusM;
  return distanceMeters(point, f) <= r;
}

function containingGroves(
  world: SessionWorld,
  point: LatLng,
): { id: string; depth: number }[] {
  const out: { id: string; depth: number }[] = [];
  for (const g of world.groves) {
    if (!pointInPolygon(point, g.boundary)) continue;
    out.push({ id: g.id, depth: distanceInsideMeters(point, g.boundary) });
  }
  out.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return out;
}

function noteGroveCurrent(
  state: SessionState,
  groveId: string,
  effects: SessionEffect[],
): SessionState {
  if (state.enteredCurrentGroveIds.includes(groveId)) {
    return { ...state, currentGroveId: groveId };
  }
  effects.push({ type: "groveEntered", groveId });
  effects.push({
    type: "analytics",
    name: "grove_entered",
    props: { grove_id: groveId },
  });
  return {
    ...state,
    currentGroveId: groveId,
    enteredCurrentGroveIds: [...state.enteredCurrentGroveIds, groveId],
  };
}

function locationModeFor(
  state: SessionState,
  world: SessionWorld,
): SessionEffect {
  if (state.phase === "idle") {
    return { type: "setLocationMode", mode: "foreground" };
  }
  if (!world.settings.locationAvailable) {
    return { type: "setLocationMode", mode: "idle" };
  }
  const last = state.recentFixes[state.recentFixes.length - 1];
  if (!last) return { type: "setLocationMode", mode: "balanced" };
  const point = { lat: last.lat, lng: last.lng };
  const unlocked = unlockedIds(world);
  const completed = completedEpochIds(world);
  let nearest = Infinity;
  for (const f of world.fragments) {
    if (f.visibility !== "standard" || f.retired) continue;
    if (!unlocked.has(f.id) || completed.has(f.id)) continue;
    if (!pickVersion(f.versions, world.timeWindow, world.lang)) continue;
    nearest = Math.min(nearest, distanceMeters(point, f));
  }
  return {
    type: "setLocationMode",
    mode: nearest <= LOCATION_HIGH_WITHIN_M ? "high" : "balanced",
  };
}

function visitGroves(
  state: SessionState,
): { groveId: string; fragmentsCompleted: number }[] {
  return state.groveIds.map((groveId) => ({
    groveId,
    fragmentsCompleted: state.completionsByGrove[groveId] ?? 0,
  }));
}

function endSession(
  state: SessionState,
  at: number,
  world: SessionWorld,
  effects: SessionEffect[],
  opts: { recordProgressFromPlaying: boolean },
): SessionState {
  if (state.phase !== "exploring" || !state.sessionId || state.startedAt === null) {
    return initialSessionState();
  }
  const sessionId = state.sessionId;
  if (state.playing) {
    effects.push({ type: "stopNarration" });
    if (opts.recordProgressFromPlaying) {
      effects.push({
        type: "recordProgress",
        fragmentId: state.playing.fragmentId,
        revisionNo: state.playing.revisionNo,
        timeWindow: state.playing.version.timeWindow,
        maxProgressMs: computedPlayedMs(state.playing, at),
      });
    }
  }
  effects.push({
    type: "writeVisit",
    sessionId,
    startedAt: state.startedAt,
    endedAt: at,
    timeWindow: world.timeWindow,
    groves: visitGroves(state),
  });
  const minutes = Math.max(0, Math.round((at - state.startedAt) / 60_000));
  effects.push({
    type: "analytics",
    name: "session_ended",
    props: {
      fragments_completed: state.fragmentsCompletedThisSession.length,
      minutes,
    },
  });
  effects.push({ type: "sessionEnded", sessionId, at });
  effects.push({ type: "setLocationMode", mode: "idle" });
  return initialSessionState();
}

function tryStartSession(
  state: SessionState,
  at: number,
  sessionId: string | undefined,
  world: SessionWorld,
  effects: SessionEffect[],
  groveIdsToAdd: string[],
  currentGroveId: string | null,
): SessionState | null {
  if (state.phase !== "idle") return null;
  if (!sessionId) return null;

  let next: SessionState = {
    ...initialSessionState(),
    phase: "exploring",
    sessionId,
    startedAt: at,
    groveIds: [...groveIdsToAdd],
    currentGroveId: null,
    lastInsideGroveAt: at,
    recentFixes: state.recentFixes,
  };

  effects.push({ type: "sessionStarted", sessionId, at });
  effects.push({ type: "analytics", name: "session_started", props: {} });

  if (currentGroveId) {
    next = noteGroveCurrent(next, currentGroveId, effects);
  }

  effects.push(locationModeFor(next, world));
  return next;
}

function emitPlay(
  state: SessionState,
  world: SessionWorld,
  fragmentId: string,
  via: TriggerVia,
  at: number,
  effects: SessionEffect[],
): SessionState {
  const f = fragmentById(world, fragmentId);
  if (!f) return state;
  const version = pickVersion(f.versions, world.timeWindow, world.lang);
  if (!version) return state;
  const revisionNo = metaOf(world, fragmentId).revisionNo;
  const changeTeaser =
    heardOlderEpoch(f, world.completions) && !completedEpoch(f, world.completions)
      ? metaOf(world, fragmentId).changeTeaser
      : undefined;
  effects.push({
    type: "play",
    fragmentId,
    revisionNo,
    version,
    via,
    ...(changeTeaser ? { changeTeaser } : {}),
  });
  return {
    ...state,
    playing: {
      fragmentId,
      revisionNo,
      version,
      via,
      startedAt: at,
      pausedAt: null,
      pausedTotalMs: 0,
    },
    queued: null,
  };
}

function applyChosen(
  state: SessionState,
  world: SessionWorld,
  at: number,
  chosen:
    | {
        fragment: FragmentInput;
        distanceM: number;
        via: "proximity" | "accessible";
      }
    | { fragmentId: string; via: "scan" }
    | null,
  effects: SessionEffect[],
): SessionState {
  // While paused, the queue waits — treat as still playing for queueAfterTrigger.
  const result = queueAfterTrigger({
    chosen,
    playingFragmentId: state.playing?.fragmentId ?? null,
    queued: state.queued,
    afterglowEndsAt:
      state.afterglowEndsAt !== null ? new Date(state.afterglowEndsAt) : null,
    now: new Date(at),
    stillInRange: (id) => stillInRange(world, state, id),
    isEligible: (id) => isEligibleId(world, id),
  });
  let next: SessionState = { ...state, queued: result.queued };
  if (result.startNow) {
    const via =
      chosen && "fragment" in chosen
        ? chosen.via
        : chosen && "via" in chosen
          ? chosen.via
          : (state.queued?.via ?? "proximity");
    next = emitPlay(next, world, result.startNow, via, at, effects);
  }
  return next;
}

function drainQueue(
  state: SessionState,
  world: SessionWorld,
  at: number,
  effects: SessionEffect[],
): SessionState {
  return applyChosen(state, world, at, null, effects);
}

function clearAfterglowIfDue(
  state: SessionState,
  at: number,
  world: SessionWorld,
  effects: SessionEffect[],
): SessionState {
  if (
    state.afterglowEndsAt !== null &&
    at >= state.afterglowEndsAt &&
    state.playing === null
  ) {
    return drainQueue({ ...state, afterglowEndsAt: null }, world, at, effects);
  }
  return state;
}

function checkTimeouts(
  state: SessionState,
  at: number,
  world: SessionWorld,
  effects: SessionEffect[],
): SessionState {
  if (state.phase !== "exploring" || !state.startedAt) return state;
  if (at - state.startedAt >= SESSION_MAX_MS) {
    return endSession(state, at, world, effects, {
      recordProgressFromPlaying: true,
    });
  }
  if (
    state.lastInsideGroveAt !== null &&
    at - state.lastInsideGroveAt >= OUTSIDE_END_MS
  ) {
    return endSession(state, at, world, effects, {
      recordProgressFromPlaying: true,
    });
  }
  return state;
}

function updateContainingGroves(
  state: SessionState,
  world: SessionWorld,
  point: LatLng,
  at: number,
  effects: SessionEffect[],
): SessionState {
  const containing = containingGroves(world, point);
  if (containing.length === 0) return state;

  const groveIds = [...state.groveIds];
  for (const c of containing) {
    if (!groveIds.includes(c.id)) groveIds.push(c.id);
  }
  let next: SessionState = {
    ...state,
    groveIds,
    lastInsideGroveAt: at,
  };
  const deepest = containing[0]!.id;
  if (deepest !== next.currentGroveId) {
    next = noteGroveCurrent(next, deepest, effects);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function sessionStep(
  state: SessionState,
  event: SessionEvent,
  world: SessionWorld,
): { state: SessionState; effects: SessionEffect[] } {
  const effects: SessionEffect[] = [];
  let next = state;

  switch (event.type) {
    case "fix": {
      const fix = {
        at: event.at,
        lat: event.lat,
        lng: event.lng,
        accuracyM: event.accuracyM,
      };
      next = {
        ...next,
        recentFixes: [...next.recentFixes, fix].filter(
          (f) => event.at - f.at <= TWO_FIX_WINDOW_MS,
        ),
      };

      const point = { lat: event.lat, lng: event.lng };
      const containing = containingGroves(world, point);

      if (next.phase === "idle") {
        if (containing.length > 0 && world.settings.locationAvailable) {
          const started = tryStartSession(
            next,
            event.at,
            event.sessionId,
            world,
            effects,
            containing.map((c) => c.id),
            containing[0]!.id,
          );
          if (started) next = started;
        }
      } else {
        next = updateContainingGroves(next, world, point, event.at, effects);
      }

      // Proximity while exploring (including the fix that just started).
      // While paused, queueAfterTrigger still updates the queue but will not startNow.
      if (next.phase === "exploring" && world.settings.locationAvailable) {
        const standard = world.fragments.filter(
          (f) => f.visibility === "standard",
        );
        const fixes: LocationFix[] = next.recentFixes.map((f) => ({
          at: new Date(f.at),
          lat: f.lat,
          lng: f.lng,
          accuracyM: f.accuracyM,
        }));
        const candidates = proximityCandidates({
          fragments: standard,
          fixes,
          accuracyToleranceM: world.settings.accuracyToleranceM,
          unlockedIds: unlockedIds(world),
          completedEpochIds: completedEpochIds(world),
          timeWindow: world.timeWindow,
          lang: world.lang,
          accessible: world.settings.accessibleTrigger,
          playingFragmentId: next.playing?.fragmentId ?? null,
        });
        const chosen = chooseTrigger(candidates);
        next = applyChosen(next, world, event.at, chosen, effects);
        effects.push(locationModeFor(next, world));
      }

      next = clearAfterglowIfDue(next, event.at, world, effects);
      next = checkTimeouts(next, event.at, world, effects);
      break;
    }

    case "scan": {
      next = { ...next, lastInsideGroveAt: event.at };
      const fragmentId = world.markers[event.markerHash];
      if (!fragmentId) break;

      const f = fragmentById(world, fragmentId);
      if (!f || f.retired) break;

      if (next.phase === "idle") {
        const started = tryStartSession(
          next,
          event.at,
          event.sessionId,
          world,
          effects,
          f.groveId ? [f.groveId] : [],
          f.groveId,
        );
        if (!started) break;
        next = started;
      } else if (f.groveId && !next.groveIds.includes(f.groveId)) {
        // Scan in another grove must still appear on writeVisit.
        next = { ...next, groveIds: [...next.groveIds, f.groveId] };
      }

      const unlocked = isUnlocked(
        f,
        world.fragments,
        world.externalPrerequisites,
        world.completions,
        world.unlocks,
      ).unlocked;
      const version = pickVersion(f.versions, world.timeWindow, world.lang);
      const hasVersion = version !== undefined;

      if (!unlocked) {
        const changeTeaser = metaOf(world, fragmentId).changeTeaser;
        effects.push({
          type: "showTeaser",
          fragmentId,
          reason: "locked",
          ...(changeTeaser ? { changeTeaser } : {}),
        });
        break;
      }
      if (!hasVersion) {
        effects.push({
          type: "showTeaser",
          fragmentId,
          reason: "wrongTime",
        });
        break;
      }

      // Physical only via scan (FR-4). Standard markers are not scan-played.
      if (f.visibility !== "physical") break;
      const decision = scanDecision(f, unlocked, hasVersion);
      if (!decision.play) break;

      next = applyChosen(
        next,
        world,
        event.at,
        { fragmentId, via: "scan" },
        effects,
      );
      next = clearAfterglowIfDue(next, event.at, world, effects);
      next = checkTimeouts(next, event.at, world, effects);
      break;
    }

    case "narrationPaused": {
      if (!next.playing || next.playing.pausedAt !== null) break;
      next = {
        ...next,
        playing: { ...next.playing, pausedAt: event.at },
      };
      next = checkTimeouts(next, event.at, world, effects);
      break;
    }

    case "narrationResumed": {
      if (!next.playing || next.playing.pausedAt === null) break;
      const pausedTotalMs =
        next.playing.pausedTotalMs +
        Math.max(0, event.at - next.playing.pausedAt);
      next = {
        ...next,
        playing: {
          ...next.playing,
          pausedAt: null,
          pausedTotalMs,
        },
      };
      next = checkTimeouts(next, event.at, world, effects);
      break;
    }

    case "narrationEnded": {
      if (!next.playing) break;
      const playing = next.playing;
      const frag = fragmentById(world, playing.fragmentId);

      if (event.reason === "natural") {
        const completion: CompletionRow = {
          fragmentId: playing.fragmentId,
          revisionNo: playing.revisionNo,
          timeWindow: playing.version.timeWindow,
          onSite: true,
        };
        effects.push({
          type: "recordCompletion",
          fragmentId: playing.fragmentId,
          revisionNo: playing.revisionNo,
          timeWindow: playing.version.timeWindow,
          onSite: true,
          trigger: playing.via,
          sessionId: next.sessionId!,
        });
        const unlockIds = unlocksToWrite(
          world.fragments,
          world.externalPrerequisites,
          [...world.completions, completion],
          world.unlocks,
        );
        effects.push({ type: "writeUnlocks", fragmentIds: unlockIds });
        effects.push({
          type: "metCharacters",
          characterIds: metaOf(world, playing.fragmentId).characterIds ?? [],
          fragmentId: playing.fragmentId,
        });
        effects.push({
          type: "analytics",
          name: "fragment_completed",
          props: { fragment_id: playing.fragmentId },
        });
        const endsAt = event.at + AFTERGLOW_MS;
        effects.push({
          type: "startAfterglow",
          endsAt,
          fragmentId: playing.fragmentId,
          tier: frag?.tier ?? "leaf",
        });

        const groveId = frag?.groveId;
        const completionsByGrove = { ...next.completionsByGrove };
        if (groveId) {
          completionsByGrove[groveId] = (completionsByGrove[groveId] ?? 0) + 1;
        }
        next = {
          ...next,
          playing: null,
          afterglowEndsAt: endsAt,
          fragmentsCompletedThisSession: [
            ...next.fragmentsCompletedThisSession,
            playing.fragmentId,
          ],
          completionsByGrove,
          lastCompletedFragmentId: playing.fragmentId,
        };
      } else {
        // stopped | interrupted — playedMs from the event is authoritative
        effects.push({
          type: "recordProgress",
          fragmentId: playing.fragmentId,
          revisionNo: playing.revisionNo,
          timeWindow: playing.version.timeWindow,
          maxProgressMs: event.playedMs,
        });
        let queued = next.queued;
        if (event.reason === "stopped") {
          queued = null;
        } else if (queued && queued.via !== "scan") {
          // interrupted keeps a queued scan only
          queued = null;
        }
        next = {
          ...next,
          playing: null,
          queued,
          afterglowEndsAt: null,
        };
      }
      next = checkTimeouts(next, event.at, world, effects);
      break;
    }

    case "afterglowElapsed": {
      if (next.afterglowEndsAt === null) break;
      if (event.at < next.afterglowEndsAt) break;
      next = { ...next, afterglowEndsAt: null };
      next = drainQueue(next, world, event.at, effects);
      next = checkTimeouts(next, event.at, world, effects);
      break;
    }

    case "tick": {
      next = clearAfterglowIfDue(next, event.at, world, effects);
      next = checkTimeouts(next, event.at, world, effects);
      break;
    }

    case "stop": {
      next = endSession(next, event.at, world, effects, {
        recordProgressFromPlaying: true,
      });
      break;
    }

    case "settingsChanged": {
      // Merge event values for this step; shell passes updated world afterwards.
      const worldForStep: SessionWorld = {
        ...world,
        settings: {
          ...world.settings,
          accessibleTrigger: event.accessibleTrigger,
          locationAvailable: event.locationAvailable,
        },
      };
      next = checkTimeouts(next, event.at, worldForStep, effects);
      if (next.phase === "exploring") {
        effects.push(locationModeFor(next, worldForStep));
      }
      break;
    }

    case "windowChanged": {
      if (next.queued) {
        const qf = fragmentById(world, next.queued.fragmentId);
        if (
          !qf ||
          !pickVersion(qf.versions, event.timeWindow, world.lang)
        ) {
          next = { ...next, queued: null };
        }
      }
      next = checkTimeouts(next, event.at, world, effects);
      break;
    }

    default:
      break;
  }

  return { state: next, effects };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function storyStateOf(
  state: SessionState,
  world: SessionWorld,
): StoryState {
  const playing = state.playing
    ? fragmentById(world, state.playing.fragmentId)
    : undefined;
  const last = state.lastCompletedFragmentId
    ? fragmentById(world, state.lastCompletedFragmentId)
    : undefined;

  const groveId =
    playing?.groveId ??
    state.currentGroveId ??
    (state.groveIds.length > 0
      ? state.groveIds[state.groveIds.length - 1]
      : undefined);

  const heard = new Set<string>();
  for (const f of world.fragments) {
    if (completedEpoch(f, world.completions)) heard.add(f.id);
  }

  return {
    ...(groveId ? { groveId } : {}),
    ...(playing
      ? {
          playingFragmentId: playing.id,
          playingTier: playing.tier,
          playingThreadIds: [...playing.threadIds],
        }
      : { playingThreadIds: [] }),
    ...(last
      ? {
          lastFragmentId: last.id,
          lastTier: last.tier,
          lastThreadIds: [...last.threadIds],
        }
      : { lastThreadIds: [] }),
    heard,
    timeWindow: world.timeWindow,
    narrationPlaying: state.playing !== null,
  };
}
