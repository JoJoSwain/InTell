# A4 plan — session state machine

Lane A · A4. Plan only. No module code in this commit.

Pure reducer and selectors in `packages/shared`. Lane B's M6 wires location, audio and SQLite. Lane A does not edit `apps/mobile`.

Out of scope: phone code, Hush (`hush.ts`), Journal growth audio (documented hook only), analytics transport.

Sources: PRODUCT_SPEC §5.1 / FR-3–8, TECH_SPEC §3.1–3.3, AUDIO_SPEC §4.1 / §5, ADR 0004 (13, 16, 28), ADR 0005 §3, ADR 0006, DATA_MODEL §14, and the existing `trigger` / `unlock` / `polygon` / `timeWindow` helpers.

---

## Types

Module: `packages/shared/src/story/session.ts` (plus `session.test.ts`, `sessionWalk.test.ts`). Export from `@intell/shared`. Document the public surface in the module header for M6.

All persisted fields are JSON-safe: strings, numbers, plain objects/arrays. No `Date`, no `Set`.

### Time

Events carry `at: number` — **Unix epoch milliseconds**. The shell converts `Date` / GPS timestamps once. Helpers that still take `Date` (`LocationFix`, `queueAfterTrigger`) get values built at the call site: `new Date(at)`.

### State

```ts
export type SessionPhase = "idle" | "exploring";

export type PlayingRef = {
  fragmentId: string;
  revisionNo: number;
  version: { lang: string; timeWindow: "day" | "night" };
  via: "proximity" | "accessible" | "scan";
  startedAt: number; // epoch ms
};

export type SessionState = {
  phase: SessionPhase;
  /** Present only while exploring. */
  sessionId: string | null;
  startedAt: number | null;
  /** Groves entered this session (ids), for the visit record. */
  groveIds: string[];
  playing: PlayingRef | null;
  queued: { fragmentId: string; via: "proximity" | "accessible" | "scan" } | null;
  /** When set, afterglow is active until this epoch ms. */
  afterglowEndsAt: number | null;
  /** Last time the listener was "inside" (any grove piece, or a scan). */
  lastInsideGroveAt: number | null;
  /** Completed fragment ids this session (for visit + analytics). */
  fragmentsCompletedThisSession: string[];
  /** Last natural completion this session (for storyStateOf last*). */
  lastCompletedFragmentId: string | null;
  /**
   * Recent accurate-enough fixes for proximity pairing.
   * Trimmed to the last 60 s (TWO_FIX_WINDOW_MS) on each fix.
   */
  recentFixes: { at: number; lat: number; lng: number; accuracyM: number }[];
};
```

Initial state: `phase: "idle"`, all nullable fields `null`, arrays empty.

### Events

```ts
export type SessionEvent =
  | {
      type: "fix";
      at: number;
      lat: number;
      lng: number;
      accuracyM: number;
      /** Required when this event starts a session (idle → exploring). Shell-generated UUID. */
      sessionId?: string;
    }
  | {
      type: "scan";
      at: number;
      markerHash: string;
      sessionId?: string; // same rule as fix
    }
  | {
      type: "narrationEnded";
      at: number;
      reason: "natural" | "stopped" | "interrupted";
      playedMs: number;
    }
  | { type: "afterglowElapsed"; at: number }
  | { type: "tick"; at: number } // timeouts: afterglow, 15 min outside, 3 h
  | { type: "stop"; at: number }
  | {
      type: "settingsChanged";
      at: number;
      accessibleTrigger: boolean;
      locationAvailable: boolean;
    }
  | {
      type: "windowChanged";
      at: number;
      timeWindow: "day" | "night";
    };
```

`settingsChanged` / `windowChanged` also update what the shell passes in `world` on the next steps; the event itself carries the new values so the reducer can act without a second round-trip.

### World (read-only snapshot)

```ts
export type SessionWorld = {
  groves: readonly {
    id: string;
    boundary: GeoJsonMultiPolygon; // pack schema 4
  }[];
  fragments: readonly FragmentInput[]; // existing unlock type
  /** Optional UI/copy fields not on FragmentInput today. */
  fragmentMeta: Readonly<
    Record<
      string,
      {
        revisionNo: number; // current pack revision
        teaser?: string;
        changeTeaser?: string;
        characterIds?: string[];
      }
    >
  >;
  /** Cross-grove unlock inputs (from packs' externalPrerequisites). */
  externalPrerequisites: readonly ExternalPrerequisite[];
  /** markerHash (sha256 hex) → fragmentId */
  markers: Readonly<Record<string, string>>;
  completions: readonly CompletionRow[];
  unlocks: readonly UnlockRow[];
  timeWindow: "day" | "night";
  lang: string;
  settings: {
    accessibleTrigger: boolean;
    locationAvailable: boolean;
    /** FR-3 tolerance; provisional test default 25 m until M6 field tune. */
    accuracyToleranceM: number;
  };
};
```

### Effects

Discriminated union. **No coordinates** in any payload.

```ts
export type SessionEffect =
  | { type: "sessionStarted"; sessionId: string; at: number }
  | { type: "sessionEnded"; sessionId: string; at: number }
  | {
      type: "setLocationMode";
      mode: "idle" | "foreground" | "balanced" | "high";
    }
  | {
      type: "play";
      fragmentId: string;
      revisionNo: number;
      version: { lang: string; timeWindow: "day" | "night" };
      via: "proximity" | "accessible" | "scan";
    }
  | { type: "stopNarration" } // Stop / session end while playing
  | {
      type: "showTeaser";
      fragmentId: string;
      changeTeaser?: string; // ADR 0005 §3 when changed
    }
  | {
      type: "recordCompletion";
      fragmentId: string;
      revisionNo: number;
      timeWindow: "day" | "night";
      onSite: true;
      trigger: "proximity" | "accessible" | "scan";
      sessionId: string;
    }
  | {
      type: "recordProgress";
      fragmentId: string;
      revisionNo: number;
      timeWindow: "day" | "night";
      maxProgressMs: number;
    }
  | { type: "writeUnlocks"; fragmentIds: string[] }
  | { type: "metCharacters"; characterIds: string[]; fragmentId: string }
  | {
      type: "writeVisit";
      sessionId: string;
      groveIds: string[];
      startedAt: number;
      endedAt: number;
      fragmentsCompleted: number;
      timeWindow: "day" | "night";
    }
  | { type: "startAfterglow"; endsAt: number } // shell may schedule afterglowElapsed
  | {
      type: "analytics";
      name:
        | "grove_entered"
        | "session_started"
        | "fragment_completed"
        | "session_ended";
      props: Record<string, string | number | boolean>; // no coords
    }
  /** M9 hook only — shell ignores until Journal growth exists. */
  | { type: "growthMoment"; fragmentId: string; revisionNo: number };
```

Reducer signature:

```ts
export function sessionStep(
  state: SessionState,
  event: SessionEvent,
  world: SessionWorld,
): { state: SessionState; effects: SessionEffect[] };

export function storyStateOf(
  state: SessionState,
  world: SessionWorld,
  /** Optional: grove containing the current fix, from the shell. */
  containingGroveId?: string,
): StoryState; // AUDIO_SPEC §4.1; `heard` built as a Set from completions for current epochs
```

---

## Composing existing helpers

| Concern | Helper | Session usage |
|---|---|---|
| Inside a grove | `pointInPolygon(fix, grove.boundary)` | Start session; update `lastInsideGroveAt` / `groveIds`; 15 min outside clock |
| Trigger candidates | `proximityCandidates` | On `fix` while exploring (and location available); map `recentFixes` → `LocationFix` with `Date` |
| Pick among candidates | `chooseTrigger` | After candidates |
| Queue of one | `queueAfterTrigger` | After choose / scan / afterglow / window change; pass `stillInRange` and `isEligible` closures |
| Physical scan | `scanDecision` | On `scan` after resolving `markerHash` |
| Version for window | `pickVersion` | Before `play`; Day-only silent at night |
| Unlock writes | `unlocksToWrite` | After natural completion (with completions including the new row in the *logical* sense: shell writes, world on next event includes it — see below) |
| Marker / changed | `markerState` | Eligibility table tests; teaser path may use `changeTeaser` from meta when pulse would be `changed` |
| Distance for location mode | `distanceMeters` | Nearest candidate vs 150 m → `balanced` / `high` |

**No rewrite** of those modules for A4 unless a tiny, tested extension is required:

1. **Eligibility closure** for `queueAfterTrigger.isEligible`:** unlocked + not retired + has version for `world.timeWindow` + not completed for current contingency epoch — same rules as `proximityCandidates`' private `eligible`, plus physical only via scan. Prefer a small exported `isPlayableNow(fragment, …)` in `unlock.ts` (or reuse `markerState(...).playableNow` for standard fragments) so session and trigger stay aligned. Physical playable = unlocked + version (scan path).
2. **`LocationFix.at: Date`:** keep as-is; session converts at the boundary. Do not put `Date` in `SessionState`.
3. **`FragmentInput`:** leave unchanged. Teaser / change teaser / revisionNo / characters live in `world.fragmentMeta` so packs/UI can supply them without widening the unlock input for A4.

**Unlocks after completion:** on natural end, effects include `recordCompletion` then `writeUnlocks` computed with `unlocksToWrite(fragments, external, [...world.completions, newCompletion], world.unlocks)`. The reducer does **not** mutate world; it synthesizes the completion row for that call only.

---

## Session id and timestamps

| Value | Source |
|---|---|
| `sessionId` | Shell generates a UUID v4 **before** dispatching the `fix` or `scan` that starts exploring, and puts it on that event. The reducer copies it into state and onto `sessionStarted` / visit / completion effects. If idle would start but `sessionId` is missing → **no start** (see Spec gaps). |
| `at` on every event | Shell; GPS time or monotonic wall clock in ms. |
| `startedAt` | `at` of the starting event. |
| `playing.startedAt` | `at` of the `play` decision. |
| `afterglowEndsAt` | `at + AFTERGLOW_MS` (8_000) on natural `narrationEnded`. |
| `lastInsideGroveAt` | Updated on every `fix` inside any grove piece, and on every `scan` (brief: a scan counts as inside). |
| Visit `endedAt` | `at` of the ending event (`stop` / timeout / …). |

Constants (exported):

```ts
export const AFTERGLOW_MS = 8_000;
export const OUTSIDE_END_MS = 15 * 60_000;
export const SESSION_MAX_MS = 3 * 60 * 60_000;
export const LOCATION_HIGH_WITHIN_M = 150;
```

---

## Timeouts (from events only)

No timers inside the reducer.

| Timeout | Armed when | Fired when |
|---|---|---|
| Afterglow 8 s | Natural `narrationEnded` sets `afterglowEndsAt = at + 8000`, effect `startAfterglow` | `afterglowElapsed` with `at >= afterglowEndsAt`, **or** `tick` / `fix` / `scan` with the same condition (idempotent clear) |
| 15 min outside | Exploring; each step compares `at - lastInsideGroveAt` | `tick` or `fix` (or any event with `at`) while exploring, not playing through an end path, and `lastInsideGroveAt` is set and delta ≥ `OUTSIDE_END_MS` |
| 3 h session | `startedAt` set | Same: `at - startedAt >= SESSION_MAX_MS` |

Priority when several could fire on one event: **stop narration / end session** wins over starting afterglow playback; if both 15 min and 3 h are due, one `sessionEnded` is enough. Natural end's afterglow arming happens before queue drain on a later event.

`tick` exists so the shell can wake the machine without a GPS fix (afterglow and idle timers while stationary).

---

## Behavior sketch (by event)

### `fix`
1. Append to `recentFixes`; drop fixes older than `at - TWO_FIX_WINDOW_MS`.
2. If `pointInPolygon` any grove: update `lastInsideGroveAt`, add grove id to `groveIds`.
3. **Idle + inside + location available + `sessionId`:** → exploring; effects `sessionStarted`, `analytics session_started` / `grove_entered`, `setLocationMode` (balanced/high).
4. **Exploring:** if location unavailable, skip proximity. Else `proximityCandidates` → `chooseTrigger` → `queueAfterTrigger` (with playing / afterglow). If `startNow`, emit `play` (and optional `growthMoment` hook — no-op content). Update `setLocationMode` from distance to candidates.
5. Check 15 min / 3 h end.

### `scan`
1. Resolve `markers[markerHash]`; unknown → no-op (or no teaser).
2. Update `lastInsideGroveAt` (counts as inside).
3. Idle → start like fix (needs `sessionId`).
4. `scanDecision` + version: if play → treat as chosen `{ fragmentId, via: "scan" }` into `queueAfterTrigger` (scan always replaces queue). If not play → `showTeaser` (include `changeTeaser` from meta when the fragment is unlocked-but-changed / locked per ADR 0005 — see gaps).

### `narrationEnded`
- **natural:** `recordCompletion`, `writeUnlocks`, `metCharacters`, `analytics fragment_completed`; clear `playing`; set afterglow; do **not** start queue until afterglow ends.
- **stopped | interrupted:** `recordProgress` with `playedMs`; clear `playing` and **queue**; **no** afterglow, **no** completion/unlock. (Shell lock-screen resume is outside this machine.)

### `afterglowElapsed` / tick past afterglow
Clear afterglow; run `queueAfterTrigger` with `chosen: null` to start queued if still eligible / in range (scan always).

### `windowChanged`
Update eligibility: if `queued` has no `pickVersion` for the new window, drop it. Playing continues to end (FR-6: version chosen at start).

### `settingsChanged`
Store nothing in state (world carries settings). If `locationAvailable` becomes false, proximity stops; scans still work. Accessible off → next `fix` uses two-fix path only.

### `stop` / timeout end
If playing → `stopNarration` + `recordProgress` (if we have playedMs — **gap:** stop event has no playedMs; see Spec gaps). Clear queue/afterglow. `writeVisit`, `analytics session_ended`, `setLocationMode idle`, `sessionEnded`. → idle.

---

## `storyStateOf`

Build AUDIO_SPEC §4.1 `StoryState` for the AudioDirector:

- `groveId`: `containingGroveId` from the shell (optional arg), else first of `state.groveIds` while exploring, else undefined.
- `playingFragmentId` / `playingTier` / `playingThreadIds` from `state.playing` + fragment.
- `lastFragmentId` / `lastTier` / `lastThreadIds` from the last natural completion this session (track `lastCompletedFragmentId` in state — **add to SessionState**).
- `heard`: `Set` of fragment ids whose completions satisfy current contingency epochs (from `world.completions` + fragments). Not persisted on `SessionState`.
- `timeWindow`, `narrationPlaying: state.playing !== null`.

Hush stays in `hush.ts`; session never calls it.

---

## Walk test setup

File: `packages/shared/src/story/sessionWalk.test.ts`.

1. **Load geometry / route:** Prefer parsing `apps/mobile/e2e/demo-route.gpx` (Lane A may **read** it in tests; do not edit mobile). Fallback: rebuild points with `tools/demo-geometry` logic if import path is awkward — still no mobile source edits.
2. **World:** Farmington demo fragments as `FragmentInput[]` (ids and graph matching seed / fixture): unlocks empty; completions empty; MultiPolygon from `groveShape` of those fragments (or a fixture polygon that contains the route dwells).
3. **Time base:** `t0` = fixed epoch. Each GPX point is +1 s (`at = t0 + i * 1000`), matching demo-geometry's 1 point/s pace.
4. **Narration:** at each dwell, when `play` fires, the test injects `narrationEnded` `{ reason: "natural", playedMs: durationMs }` at `at + durationMs`, using durations from `supabase/seed-media.json` (revision-1) + the fixture's "+ 5 s" dwell already in the GPX. The test does **not** wait real time; it jumps `at`.
5. **Accuracy:** all fixes `accuracyM` below `accuracyToleranceM` (25).
6. **Assertions (M6 mirror):**
   - each unlocked standard fragment `play`s exactly once in tier/prereq order along the route
   - locked / no-version never `play`
   - never two `play` without an intervening natural end + afterglow clear
   - contingency fixture: older completion → plays again; correction → does not
   - Day-only fragment: `windowChanged` to night → no play / queue dropped
   - after last exit from boundary, advance `at` by 15 min → `sessionEnded` / `writeVisit`
7. **Resume:** deep-clone JSON `SessionState` mid-`playing` and mid-afterglow; `sessionStep` continues with the same effects order.
8. **Privacy property:** every effect from the walk, `JSON.stringify` must not match coordinate number patterns from the GPX (and must not contain `"lat"` / `"lng"` keys).

---

## Order of work

1. Types + `initialSessionState` + zod optional (`SessionState` parse for resume).
2. Idle → exploring (`fix` / `scan`) + location mode effects + privacy assertions on those effects.
3. Proximity / accessible play + queue via helpers; eligibility table tests.
4. Scan play / teaser.
5. Natural end → completion / unlocks / characters / afterglow → queue drain; stopped / interrupted → progress.
6. `windowChanged`, `settingsChanged`, stop, 15 min, 3 h.
7. `storyStateOf` + Hush boundary comment.
8. Walk test + resume test.
9. Export from `packages/shared`; `pnpm lint && typecheck && test`.

---

## Spec gaps (do not guess)

1. **`sessionId` missing on a starting event.** Plan: refuse to start. Confirm the shell always supplies it.
2. **`accuracyToleranceM` default.** FR-3 defers to M6 field tests. Plan uses **25 m in tests** and requires `world.settings.accuracyToleranceM` with no silent default in production code — or confirm a shipped default.
3. **`stop` while playing:** `recordProgress` needs `maxProgressMs`, but `stop` has no `playedMs`. Options: (a) require `playedMs` on `stop`, (b) emit only `stopNarration` and let the shell call `narrationEnded` `{ reason: "stopped", playedMs }` first. **Need a decision.**
4. **TECH_SPEC §3.2 diagram** still shows `arrived(fragmentId)` and `(growthMoment?)`. A4 events are `fix` / `scan`; growth is an optional effect hook with no Journal wiring. Confirm diagram is outdated (brief already points at the reducer shape).
5. **Teaser vs change teaser on scan.** Locked → teaser; completed-older-contingency → change teaser (ADR 0005 §3). Exact matrix when both locked and changed — confirm.
6. **`writeVisit` / `groveIds`:** all groves entered this session (plan) vs only groves containing the listener at end. DATA_MODEL visit is per `grove_id` — may need **one visit row per groveId** in `groveIds`. Confirm.
7. **Overlapping MultPolygons / multiple containing groves on one fix:** add all to `groveIds`; `storyStateOf.groveId` preference order?
8. **Unknown marker hash:** silent no-op vs analytics. Prefer silent no-op.
9. **Physical fragment + proximity:** helpers already exclude physical from proximity; confirm session never passes them to `proximityCandidates` (or passes them and relies on `eligible` requiring `standard`).
10. **Correction vs contingency in the walk test:** need a minimal synthetic fragment set beyond Farmington if seed has no correction case — confirm using a hand-built fragment graph in the test is OK.
11. **AUDIO_SPEC `heard: Set<string>`** vs JSON state: selector returns a `Set`; persisted state does not store it. Confirm AudioDirector accepts a fresh Set each tick.
12. **Chime / haptic / ducking:** PRODUCT_SPEC §5.1 step 2. Not listed as session effects in the brief — assume AudioDirector / shell on `play`, not the reducer.
