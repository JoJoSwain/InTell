# A6 report — AudioDirector

**Lane A · A6** · branch `a/a6-audio-director`  
Sources: `A6-audio-director.md`, `A6-plan.md`, `A6-plan-review.md` (review wins).

No database reset. No `apps/mobile` edits. Did not touch `oneshotSchedule.ts`, `AudioEngine.ts`, or create `voiceLedger.ts` (B·S2).

## What changed

### Shared AudioDirector (`packages/shared`)
- `audio/director.ts` + `directorTypes.ts` + `directorDiff.ts` — pure `directorStep(state, input, world) → { state, commands }`
- Versioned serializable state (`v: 1`, `parseDirectorState` / `serializeDirectorState`)
- Target-mix-and-diff; while suspended: no play/start/load; unload/stop allowed
- Composes existing rules: ambience, music (+ growth deferral), hush, ducking, motif, resolve, teaser, beacon, breath accents, mix health, voices
- Director accent horizon: `DIRECTOR_ACCENT_LOOKAHEAD_SEC = 20`, `DIRECTOR_ACCENT_MAX_PENDING = 2` (wrapper over `nextOneShot`)
- Inputs include host `shouldResume`, `assetFailed`, 5 s heartbeat
- Memory policy: narration prefetch + `narrationDecodeHz: 24000`, `canStreamBeds: false` by default
- Chime setting is a no-op (G7)

### Hush epoch-ms (additive)
- `hushStepMs` / `HushStateMs` / `initialHushStateMs`; Date-based `hushStep` kept as a thin wrapper

### TECH_SPEC
- AudioDirector wake is the **5 s audio-clock heartbeat** (§3.1 + §3.2)

### Admin Simulator
- `harness.ts` drives `directorStep`; all A5 harness tests still pass through it
- `applyDirectorCommands.ts` maps commands → `WebAudioEngine`
- Admin-only beacon `BiquadFilter` + host `suspendHost` / `resumeHost` on `WebAudioEngine` (shared interface unchanged)

## Tests
| Coverage | File |
|---|---|
| Director behaviours, suspend policy, resume, determinism | `director.test.ts` |
| GPX walk invariants + mid-afterglow resume | `directorWalk.test.ts` |
| Simulator via director | `harness.test.ts` (13) |
| Existing hush Date tests | `hush.test.ts` (still green) |

## Commands
```
pnpm lint       # green
pnpm typecheck  # green
pnpm test       # green (shared 256; admin 58)
```

## Not in this PR
- Phone wiring (Lane B M6/M7)
- Shared `AudioEngine` suspend/beacon APIs (M7)
- `voiceLedger` / oneshotSchedule B·S2 unification
- Engine streaming

## For Jordan
- No db reset requested or performed.
