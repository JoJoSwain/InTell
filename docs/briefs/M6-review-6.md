# M6 review 6 (Claude): the real reason narration never starts

**Verdict:** confirmed in the code. It explains every silent run today (`narration: none`, `master=0.000`, `out=-100 dB`, the MediaSession PLAYING while the overlay shows Pause). Fix it, rebuild, and run A1–A9 with Jordan right away.

## Root cause RC7: the engine has no `moment` bus, and one failure aborts the whole command batch
1. **Shared `BusId` includes `"moment"`** (A5 added it for resolves and motifs). `DuckingPolicy.BUS_DEFAULT_DB` has `moment: -8`, so the director's target mix always carries a `moment` bus gain.
2. **On a play,** `diffMix` emits, in order: `load` → `setBusGain` for each bus (story, music, surroundings, ui, **moment**) → `playNarration`.
3. **`RNAudioApiEngine.init` only creates `["story","music","surroundings","ui"]`.** `setGain("moment", …)` throws `Unknown bus moment`.
4. **`applyDirectorCommands`** runs the commands in a single loop with no per-command handling. The throw aborts the batch **before `playNarration`**.
5. **The runtime's `applyCommands` catch** finds no `sha` on the error, so it doesn't report a failed asset, and its `console.info` is stripped in release. **A completely silent failure.**
6. **Result:**
   - `prepareNarrationStart()` never runs, so master stays at about 0 after the reset or `stopAll`.
   - No narration voice exists.
   - The output reads −100 dB.
   - Meanwhile `handlePlay` has already started the MediaSession ("Walk 2 QR", PLAYING), and the session holds `playing`.
   - In A2, Resume → `resumeAfterFade` sets master to 1, but there's still no voice.

The B·S2/B·S3 spike engine predates the `moment` bus, and the fake engine accepts any bus. So no test could see this.

## Fix (small)
1. **Engine:** build the buses from the shared `BUS_DEFAULT_DB` keys, so they can't drift. That adds `moment` (connected to master, default −8 dB). Include it in `applyDucking`.
2. **`applyDirectorCommands`:** each command gets its own try/catch.
   - On failure: a breadcrumb `cmd-fail <type> <sha8?> <message>` (via `Log.w` / `InTellAudio`), then **continue with the next command**.
   - A `load` / `playNarration` / `playMoment` failure that has a sha still reports `assetFailed`.
   - A missing URI is a breadcrumb `no-uri <type> <sha8>`, never a silent `break`.
3. **Runtime `applyCommands` catch:** a breadcrumb with the error message, not `console.info`.
4. **Breadcrumb each command applied** (type + sha8), at least for `load`, `playNarration`, `stop` and `setBusGain` on `story`.
5. **Tests:**
   - The fake engine **throws on an unknown bus**, like the real one.
   - A contract test: every shared `BusId` exists in `RNAudioApiEngine`. Mock the context, or export the bus list and assert against `BUS_DEFAULT_DB`.
   - A runtime test with the real `applyDirectorCommands` and the strict fake: a scan → `playNarration` is executed and the voice is live.
   - A batch with one failing command still runs the rest.

## Next
1. Commit this review.
2. Fix RC7.
3. `pnpm lint`, `typecheck` and `test` must pass. Push. CI can finish while you test.
4. Rebuild the release app and `adb install -r` it (keep the walk packs).
5. **Run A1–A9 with Jordan immediately** (per review 5): adb scans, earbuds connected first, Jordan listens, and you read `out=` and the breadcrumbs.
6. Report one line per step, plus the first 15 breadcrumbs of A1. STOP.
