# Lane B · M6-R1 report

## What changed

- **Serial queue** on `ExploringRuntime`: every public method and engine callback goes through `serial()` / `…Now()`; `whenIdle()` for tests. `reloadSettings` is queued too.
- **`handlePlay` abandon guards** after each await; if focus was acquired and the session is no longer exploring, stop the audio session.
- **Director:** `directorSessionEffect` applies `[...story.commands, ...sessionEffect.commands]`; `onNarrationProgress` applies its commands.
- **Pause ownership** (in-memory only): listener (overlay, lock-screen remotes, becoming-noisy / `noisyPaused` / `userPaused`) vs system (focus loss). Listener-owned interruption-ended is deferred until resume so remount cannot start audio while paused.
- **Process singleton:** `getExploringRuntime()`; `ExploringProvider` never disposes on unmount. F1 still force-ends persisted `playing` on a real process restart and clears director narration so no orphan `playNarration`.
- **Tests 1–7** plus existing suites updated to `await whenIdle()` after engine-driven events.

## Commands

```
pnpm --filter @intell/mobile lint      # pass (1 pre-existing warning)
pnpm --filter @intell/mobile typecheck # pass
pnpm --filter @intell/mobile test      # 132 passed
```

Release build: `SKIP_INSTALL=1 node local/m6-walk-test/run-release-build.mjs` (no install).

## Not done

- Phone re-check (A2/A4/A6/A10/A11) — waiting until Jordan’s walk logs are saved and the phone is free.
- No `packages/shared` changes.
- Resume seek tuning stays at last breath point (listening pass).

## Open questions

None for R1 scope. Native focus machine unchanged; ownership lives in ExploringRuntime.
