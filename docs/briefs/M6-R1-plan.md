# Lane B · M6-R1 plan

Plan only. Confirms and details the design in `docs/briefs/M6-R1.md`. No `packages/shared` changes. Implementation waits on Claude's review.

Line numbers below refer to `ExploringRuntime.ts` on current `origin/master` (M6 merge tip), same shape as the audit at `c9e8eb3`.

---

## 1. Serial queue

### Shape (as in the brief)

```ts
private chain: Promise<void> = Promise.resolve();

private serial(task: () => Promise<void>): Promise<void> {
  const run = this.chain.then(task, task);
  this.chain = run.catch(() => undefined);
  return run;
}

whenIdle(): Promise<void> {
  return this.chain;
}
```

Errors inside a task are swallowed for the chain (so one failure cannot stall the queue) but still surface via breadcrumbs / existing catch sites inside the task body.

### Entry points → queue

| Entry | Today | R1 |
|---|---|---|
| Location fix listener | `void dispatch(fix)` | `void serial(() => dispatchNow(fix))` |
| Location stop-request listener | `void dispatch(stop)` | `void serial(() => dispatchNow(stop))` |
| Engine `onTick` | `void onAudioClock` | `void serial(() => onAudioClockNow)` |
| Engine `onVoiceEnded` | **returns** `onVoiceEnded(…)` promise | `void serial(() => onVoiceEndedNow(…))`; callback returns immediately (no await) |
| Engine `onNarrationProgress` | `void onNarrationProgress` | `void serial(() => onNarrationProgressNow)` |
| Engine `onInterruption` | `void onInterruption` | `void serial(() => onInterruptionNow)` |
| Engine `onRouteChange` | `void onRoute` | `void serial(() => onRouteNow)` |
| Remote command handler | `void (async () => …)()` | `void serial(() => handleRemoteNow(…))` |
| `scanCode` | `await dispatch(scan)` | public wrapper → `serial(() => scanCodeNow)` |
| `stopExploring` | `await dispatch(stop)` | public → `serial(() => stopExploringNow)` |
| `togglePause` | inline awaits | public → `serial(() => togglePauseNow)` |
| `skipBack` | sync seek | public → `serial(() => skipBackNow)` (keeps voice-id sync ordered vs play/stop) |
| `reloadPacks` | await db | public → `serial(() => reloadPacksNow)` |
| `resetSessionKeepPacks` | `await stopExploring()` then kv clear | public → `serial(() => resetSessionKeepPacksNow)` |
| `injectFix` / `injectNarrationEnded` | `await dispatch` | public → `serial(…Now)` (tests) |
| `start()` bootstrap | wires then `await dispatch` | see §1.3 |

`reloadSettings` stays unqueued (reads KV only; no session/director mutation that races audio). `dispose` stays sync and sets `disposed` so queued tasks no-op at the top.

### Split: wrapper vs `…Now()`

Every public / listener entry becomes a thin wrapper that only enqueues. The body is `fooNow()` (or `dispatchNow`).

**Rule:** code that already runs inside a queued task must call `…Now()` / `dispatchNow` / `handlePlayNow` / `directorSessionEffect` / `applyCommands` **directly**, never `serial()` again.

### Deadlock avoidance (queued task → runtime)

| Call from inside a queued task | How deadlock is avoided |
|---|---|
| `dispatch` → `applySessionEffects` → `onPlay` → `handlePlay` | `handlePlayNow` (no `serial`) |
| `handlePlayNow` → `dispatch(narrationPaused)` on focus deny | `dispatchNow` |
| `handlePlayNow` / remotes → `directorSessionEffect` → `applyCommands` | already on the chain |
| `resetSessionKeepPacksNow` → stop | `stopExploringNow` / `dispatchNow(stop)`, **not** public `stopExploring()` |
| `onVoiceEndedNow` → `dispatch(narrationEnded)` | `dispatchNow` |
| `onInterruptionNow` → `dispatch(narrationPaused/Resumed)` | `dispatchNow` |
| `applyCommands` → `engine.load` / `playNarration` (await decode) | OK: this task holds the chain; other entries wait. Engine callbacks only **enqueue** and return, so the engine never awaits the runtime while the runtime awaits the engine. |
| Fake `stopAll` awaiting voice-ended | Today the fake awaits the callback promise. After R1 the callback returns at once; tests that need completion call `await runtime.whenIdle()` after `stopAll` / `emitVoiceEnded`. |

### `start()` ordering (§1.3)

Today `wireLocation` / `wireEngine` / `wireAudioSessionRemotes` run **before** the F1 `dispatch(narrationEnded)` and window sync, so ticks/fixes can already interleave with bootstrap.

R1:

1. Construct with an empty chain.
2. Load packs/settings/kv (as today).
3. Run bootstrap work inside `serial(() => startNow())`: F1 recover-or-interrupt (§4), window sync, location mode, **then** wire listeners (or wire earlier but have every listener no-op until `bootstrapped = true` set at end of `startNow`). Prefer **wire at end of `startNow`** so nothing enqueues until bootstrap finished.
4. Callers of `start()` already `await start()`; they additionally `await whenIdle()` only if tests fire engine events in the same turn (they should not before wire).

---

## 2. `handlePlay` abandon guards

After each await in `handlePlayNow` (haptics, `audioSession.start`, `update`, `userPlay`), return early unless:

```ts
this.session.phase === "exploring" &&
this.session.playing?.fragmentId === play.fragmentId
```

On early return: `pushAudioBreadcrumb(\`play-abandoned ${tail8(play.fragmentId)}\`)`, clear overlay only if it still points at that fragment and session is no longer playing that id (avoid wiping a newer play). Do **not** call `directorSessionEffect(play)` after abandon.

If focus was acquired and then abandon fires, best-effort: leave session teardown to the stop that won the race (`onSessionEnded` / idle). Do not start a second stop from abandon.

---

## 3. Director commands — apply every step

### `directorSessionEffect`

Today: story step updates `this.director`, sessionEffect step updates again, **only `next.commands` from the second step** are applied (MOB-2).

R1:

```ts
const first = directorStep(this.director, { type: "story", … }, world);
this.director = first.state;
const second = directorStep(this.director, { type: "sessionEffect", effect, … }, world);
this.director = second.state;
await this.applyCommands([...first.commands, ...second.commands]);
```

Matches admin Simulator concatenation (`harness.ts` ~384+).

### `onNarrationProgressNow`

Today: `directorStep(narrationProgress)` then updates overlay progress; **never** `applyCommands` (MOB-2).

R1: after updating `this.director`, `await this.applyCommands(result.commands)`, then overlay progress (order: commands first so preload side effects land before UI). Persist director kv while exploring (same cadence as other director paths — either here or rely on next dispatch persist; prefer writing director kv here when `commands.length > 0` to match `directorSessionEffect`).

### Heartbeat / route / voiceEnded / assetFailed

These already apply their step's commands. No change beyond running inside `serial`.

### `applyCommands` / voice map (MOB-1 voice loss)

Serialising entry points removes the overlapping `applyCommands` that drop voices when each call does `const next = new Map(voices)` and the later write wins (`applyDirectorCommands.ts:73` + `this.voices = …`).

No change to `applyDirectorCommands` itself in R1 unless a test proves a single task still re-enters it concurrently (it should not).

---

## 4. A10 explanation and pause ownership

### What A10 showed (`local/m6-walk-test/step5-A10.txt`)

1. Mid-story live diag, then `ctx=suspended` `paused=true` — alarm took audio focus; fade-suspend / interruption **began** path ran (expected).
2. ~2 s later: **`start:interrupt-stale`** then **`narrationEnded interrupted`** — that breadcrumb exists only in `ExploringRuntime.start()` F1 when restored `session.playing` is force-ended because the new process has no voice.
3. Diag then `started=false narr=none playing=false` while phase stayed exploring; later `cmd load` / `cmd playNarration` appear without a healthy resumed session (orphan director remount / loads after the forced interrupt).

So the story did not “forget to resume” in `onInterruption("ended")` alone. The Clock alarm path caused an **Activity/JS remount** (new `ExploringProvider` → new engine → `start()`), and F1 **wiped** `playing` as interrupted. After that, interruption-ended resume (`session.playing && pausedAt`) had nothing to resume — matching TECH_SPEC’s gap for “call then resume” when the runtime is recreated mid-story.

Same-process call/BT flaps (A4/A5) never hit `start:interrupt-stale`; those are the pure MOB-4 ownership bug (ended always resumes).

### Pause ownership design

Persist a small field on the runtime (and in session KV alongside `SESSION_KV_KEY`, or inside the session JSON blob Lane B already writes — **without** changing shared session types if we keep it in a parallel kv key `pause_owner.v1` = `listener` | `system` | empty):

| Event | Owner |
|---|---|
| Overlay / `togglePauseNow` pause; remote `pause` | `listener` |
| `onInterruptionNow("began")` while playing with `pausedAt === null` | `system` (only if owner was empty; if already `listener`, leave `listener` and still run director interruption began, but do not treat as system-owned) |
| Successful listener resume / system auto-resume / narration end / session end / reset | clear owner |

**`onInterruptionNow("ended")`:**

1. Always run `directorStep(interruption ended)` and `applyCommands` filtered as today (drop director `suspend`/`resume`, keep remount `playNarration`).
2. If owner is `system` (or was system for this interruption): focus path already `resumeFadeIn`; `dispatchNow(narrationResumed)`; overlay `paused: false`; clear owner.
3. If owner is `listener`: **do not** `narrationResumed`, **do not** clear overlay paused, **do not** call `userPlay`. Keep remount commands applied so the paused engine voice matches director state; listener Resume then `userPlay` / focus as today.
4. If owner is empty and nothing paused: no-op resume (B3).

**Listener Resume** (`togglePauseNow` / remote play): if director still needs a remount after a deferred system interruption, current remount-on-play paths stay; then clear owner.

**Native focus machine:** keep fade-suspend / resumeFadeIn in `RNAudioApiEngine` + `AudioSessionController` as today. Ownership lives in **ExploringRuntime**, not Kotlin — native cannot know listener vs system. No `FocusController.kt` change planned unless implementation finds resumeFadeIn firing without a runtime `ended` callback (then note in the implementation report).

### F1 recover-on-start (A10 / process death)

Replace blind interrupt-stale when `phase === "exploring"` and `playing` is set:

1. Reload packs; if the fragment/asset is available, **remount** via `directorSessionEffect(play)` at restored progress (seek after play if engine supports it; otherwise play from last breath / start — document exact behaviour in the implementation report). Set overlay from meta; if kv says `pause_owner=listener`, leave paused and do not `userPlay`; if `system` or empty-after-interrupt, `userPlay` / start session as a system resume.
2. Only if remount is impossible (missing pack/sha): keep today’s `start:interrupt-stale` + `narrationEnded interrupted`.

This stays mobile-only (no shared schema change if owner is parallel kv). If Claude prefers F1 to stay “always interrupt” and treat A10 remount as out of scope, say so in review — then R1 still ships ownership for same-process interruptions and documents A10 as remount+F1.

**Recommendation:** implement recover-on-start in R1; it is the direct A10 fix and matches “resume once, one voice” across an alarm that recreates the activity.

---

## 5. Tests (fake engine)

Add / extend in `ExploringRuntime.test.ts` (and playPath if needed). Prefer `await runtime.whenIdle()` after engine-driven events.

| # | Test | Notes |
|---|---|---|
| 1 | Stop while `handlePlay` awaits `audioSession.start` | Fake session `start` that delays; concurrent `stopExploring`; expect no `playNarration` / `play-abandoned` crumb |
| 2 | Overlapping `applyCommands` | Two delayed loads; after `whenIdle()`, narration voice still in engine map; `stopAll` / stop reaches it |
| 3 | Story + progress commands applied | Spy/fake records commands; `directorSessionEffect` includes story-step commands; progress step applies preload (or whatever the fixture emits) |
| 4 | Playing → interruption began → ended | Pauses then resumes once; one narration voice (extend existing F3 / interruption tests) |
| 5 | Listener pause → interruption began → ended | Stays paused; then listener resume continues (new; may adjust “interruption pauses and resumes” expectations when owner is listener) |

### Existing tests that change

- Any test that relied on `onVoiceEnded`’s returned promise for ordering → `whenIdle()`.
- F1 “clears stale playing” → still valid for **impossible remount**; add a sibling for **recover-on-start** when packs exist.
- “interruption end does not apply a director resume command” (F3) — keep; ownership must not reintroduce director `resume`.
- Remote pause/play and overlay pause/resume — still pass; add owner assertions where useful.
- `fakeExploringEngine.stopAll` if it awaits callback completion — update to not deadlock with serial.

---

## 6. Risks to A1–A9 and re-check plan

| Risk | Mitigation |
|---|---|
| Serial queue delays pause UI / lock-screen | Optimistic overlay already on pause; remotes stay thin; re-check A2/A4 latency by ear |
| `play-abandoned` races a legitimate play | Guard on `playing.fragmentId`; tests for stop-during-start |
| Applying story-step commands doubles loads | Compare command lists to Simulator; watch for duplicate `playNarration` in unit tests |
| Recover-on-start double-plays with a surviving native session | New process always new engine today; if that changes, gate on `!engine.getNarrationDiag()` |
| Listener pause + system interruption remount audible blip | Keep filter suspend/resume; verify A11 stays paused |
| `skipBack` queued behind long decode | Acceptable; document if ear notices |

**Phone re-check after approval (when Jordan frees the device):** Step 4 check-play once; **A2, A4, A6, A10, A11** (brief). Optionally smoke A1/A5 if time. Same walk QR / rearm rules as M6 reset.

---

## 7. Spec ambiguities (for Claude)

1. **F1 recover-on-start vs always interrupt-stale** — plan recommends recover; confirm.
2. **Lock-screen pause owner** — treated as `listener` (same as overlay). Confirm.
3. **Parallel kv for `pause_owner`** vs embedding in existing session JSON — prefer parallel kv to avoid shared type churn; confirm.
4. **Seek on recover-on-start** — exact position API on engine; may start at 0 or last breath if seek is weak; confirm acceptable for R1.

---

## 8. Implementation order (after approval)

1. Serial queue + `…Now` splits + engine callbacks fire-and-forget + `whenIdle`.
2. `handlePlay` abandon guards.
3. Director command concatenation + progress `applyCommands`.
4. Pause ownership + interruption ended behaviour.
5. F1 recover-on-start (if approved).
6. Tests green; `pnpm lint && pnpm typecheck && pnpm test`.
7. Phone re-check subset; update `M6-R1` report / STOP.

---

## 9. Out of scope (unchanged)

- `packages/shared`
- Director-location / Day-Night preload follow-up
- Decode-twice fix
- Walk-debrief items
