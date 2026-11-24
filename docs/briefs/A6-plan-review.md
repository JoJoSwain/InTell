# A6 plan review (Claude)

**Verdict: approved, with the gap answers below.** Build A6 on `a/a6-audio-director`. Where this review and the plan differ, this review wins.

The design is right:
- a pure reducer, with clocks on every input
- versioned, serializable state
- a target mix diffed into minimal commands
- the existing rules composed rather than rewritten
- the Simulator switched over to `directorStep`

## Important: Lane B's unmerged B·S2 branch
B·S2 (`b/bs2-audio-stability`, not yet merged) already changes `packages/shared/src/audio/oneshotSchedule.ts` and `AudioEngine.ts`, and adds `voiceLedger.ts`. To avoid merge conflicts and duplicate names:
- **Don't edit** `oneshotSchedule.ts` or `AudioEngine.ts`, and **don't create** `voiceLedger.ts`.
- Give the director's own constants distinct names (`DIRECTOR_ACCENT_LOOKAHEAD_SEC = 20`, `DIRECTOR_ACCENT_MAX_PENDING = 2`). We'll unify them after both lanes merge.

## Gap answers
- **G1:** a director-only wrapper over `ambience`'s `nextOneShot`, with the look-ahead and pending cap applied in the director (see above).
- **G2:** migrate `hush.ts` to epoch ms **additively**: new epoch-ms functions, with the `Date` versions kept as thin wrappers so the existing tests still pass. The director state stores numbers only.
- **G3:** 5 s, the audio-clock heartbeat. Amend TECH_SPEC §3.2 in this PR.
- **G4:** yes, the host supplies `shouldResume` on the interruption input.
- **G5:** keep `suspend`/`resume` as host-interpreted commands. Don't change the shared `AudioEngine` interface in A6 (see above); M7 adds them. The admin `WebAudioEngine` may implement them locally.
- **G6:** while suspended:
  - Emit no `play`, `start` or `load` commands. Loads are deferred until resume.
  - `unload` and `stop` are allowed: they free memory and don't make sound.
  - `setBusGain` can wait until resume.
- **G7:** ignore the chime (a no-op) until the product defines its asset.
- **G8:** add an `assetFailed { sha }` input. The director marks that sha unusable for the session, drops whichever layer used it, and carries on. The Simulator already shows the warning.
- **G9:** yes, that's enough. B·S2's probe found that 5 minutes of narration takes 55 MB at 48 kHz and 27.5 MB at 24 kHz, and that true streaming of local files exists only through the library's file player. So:
  - `narrationDecodeHz = 24000`
  - `canStreamBeds = false` by default, with beds decoded within the LRU cap
  - when streaming is available, beds stream
- **G10:** don't create it (see above). The ledger is the engine's job; the director only tracks `activeVoiceIds` for the budget.
- **G11:** the admin `WebAudioEngine` gains a `BiquadFilter` on the beacon chain (admin only). The phone engine adds one in M7.

## Small notes
- `classToProfile` as a `ReadonlyMap` is fine in `DirectorWorld`, because the world isn't persisted. Keep `DirectorState` free of `Map` and `Set`.
- The "Listen." Hush cue plays on the `ui` bus (AUDIO_SPEC §5); resolves and motifs play on `moment`.

## Next
Implement in the plan's order. `pnpm lint`, `typecheck` and `test` must pass, and both CI jobs must be green. Write `docs/briefs/A6-report.md`, push, rename PR #33 to "A6: AudioDirector", and stop for Claude's review. Ask Jordan before any db reset; Lane A never edits `apps/mobile`.
