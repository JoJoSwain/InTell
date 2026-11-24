# B·S2 brief (Lane B): fix the spike engine, then re-run the Android protocol on a release build

**Lane:** B (Mobile) · **Branch:** `b/bs2-audio-stability` (in `C:\dev\intell-lanes\b`, cut from `b/bs1-audio-protocol` at `4bfb4f8`; this brief is its first commit) · **No plan step,** but stop after Part 2's smoke check and report before Jordan's full run.

**Why:** B·S1 failed T1, T2, T3, T6, T7 and T8 on the Pixel 11. Claude's reading of the log (below) is that most of the failure comes from our spike, not yet from the library. The spike:
- ran 3–7× more voices than AUDIO_SPEC §2.1 allows;
- leaked voices on every Stop and never disconnected finished nodes;
- relied on JS timers that don't run while the phone is locked;
- restarted gain ramps from stale values;
- didn't manage audio focus;
- ran as a debug build.

B·S2 fixes those and re-runs the protocol so ADR 0001 gets a fair verdict. **Don't change ADR 0001's Status;** Claude decides.

**Sources:**
- `docs/briefs/BS1-report.md` and `docs/spikes/logs/pixel11-2026-11-23.jsonl`
- `docs/spikes/M1-audio-test-results.md` (the protocol and its pass bars)
- `docs/AUDIO_SPEC.md` §2.1 (the voice budget), §3.1 (the 5 s evaluation cadence), §6 (asset formats)
- `docs/adr/0001-audio-engine.md` (Findings, including Claude's run-1 analysis and the decision rule for run 2)

## What the B·S1 log shows
- **Voice count.**
  - 42 at mix start: narration, 3 stems, a bed and **37 one-shots queued for the next 5 minutes** (`ONESHOT_HORIZON_SEC = 300`, one every 8 s).
  - AUDIO_SPEC §2.1's budget is 12: 1 narration, 3 stems, 2 beds and 6 one-shots.
- **Leaks on Stop.**
  - `cancelScheduledOneShots()` stops about 37 queued sources at once. Only 16–26 of them report `onEnded`; the rest stay in `voices`.
  - Over three starts of one engine, the count climbed 42 → 63 → 84 (and reached 91 in another).
  - In the library's 0.12 source, a source stopped before it starts finishes only when the clock reaches its original start time. Stop all then suspends the context, so that time never comes.
  - Either way, **don't depend on `onEnded` for a source that never started.**
- **No `disconnect()` anywhere.** Every finished chain (source → gain → panner) stays wired to its bus.
- **Clock speed** (context seconds per wall second, in 2-minute windows). Below 100%, the engine is making audio more slowly than it plays: underruns, heard as stutter, then crackle, then mush.

  | Load | Screen | Clock speed |
  |---|---|---|
  | 63 voices | unlocked | 99% |
  | 61 voices | locked | 64% in the first 2 minutes → 39% by minute 20 |
  | 82–84 voices | locked | 31% → 23% by minute 34 |
- **Cleanup on JS timers.** `stop()`, `crossfadeBed()`, loop-group stop and the interruption resume all use `setTimeout`, which doesn't run while the phone is locked.
- **Clicks (T3).** `rampGain` calls `cancelScheduledValues(now)`, which drops the ramp in progress, then restarts from `param.value`. That may not be the live ramped level, so the gain jumps.
- **Cuts instead of fades.** Stop all and pause suspend the context at once, so the 500 ms fades never render.
- **Focus (T6).** The spike didn't pause for another app's music.
  - Nine `interruption: ended` events arrived with no matching `began`.
  - The spike never subscribed to the library's `duck` event, which is likely the missing half.
- **Debug build.** It ran with the map stack mounted underneath. Native code may have been built without optimization, and the dev JS runtime and Google Maps add CPU and memory (PSS 507–552 MB).

## Part 1: engine and spike fixes
**Files:**
- `apps/mobile/src/audio/engine/RNAudioApiEngine.ts`
- `apps/mobile/app/dev/audio-spike.tsx`
- `packages/shared/src/audio/oneshotSchedule.ts`
- a new pure module, with tests, in `packages/shared/src/audio/`

Keep the `AudioEngine` interface stable. Adding fields to `EngineDiagnostics` is fine.

1. **One release path per voice:** `releaseVoice(id, reason)`, idempotent. It clears `onEnded`, calls `disconnect()` on the source, gain and panner, deletes the voice from the map and emits `voiceEnded` exactly once.
   - Call it from `onEnded` (a natural end, or the end of a faded stop).
   - Call it when cancelling a source that hasn't started: `stop()`, then release **at once**. Never wait for `onEnded`.
   - Call it from the sweep (item 3).
   - Keep the bookkeeping (created, started, released, expected end) in a pure `VoiceLedger` in `packages/shared/src/audio/voiceLedger.ts`, with Vitest coverage, so it can be tested without the library.
2. **An audio-clock heartbeat instead of JS timers.**
   - Keep **two** short silent buffer sources in flight, ending about 5 s and 10 s ahead on the audio clock (AUDIO_SPEC §3.1's 5 s cadence). Connect them to the master bus; they're silent.
   - Each heartbeat's `onEnded` releases it and runs `tick()`: the sweep, the one-shot top-up, the tour loop, diagnostics and the watchdog. Then it tops the heartbeats back up to two. With two in flight, one lost event can't stop the clock.
   - Every other engine event (a voice ending, a route change, an interruption, an app-state change) also calls `tick()`.
   - **No `setTimeout` or `setInterval` in the engine.** The spike screen's 1 s readout may keep its UI timer.
3. **The sweep** (every tick): release any voice whose expected end is more than 0.5 s behind `currentTime`. The expected end is the start time plus duration ÷ rate, or the stop time plus the fade. Count these releases as `missedEnded` in diagnostics. That number measures the library's lost `onEnded` events.
4. **A short look-ahead and a hard budget.**
   - One-shots: at most **2 pending**, at most **20 s ahead** (`ONESHOT_LOOKAHEAD_SEC = 20`, `ONESHOT_MAX_PENDING = 2`), topped up on every tick. These replace `ONESHOT_HORIZON_SEC`.
   - The engine's budget is **12 live or pending sources** (heartbeats excluded). Over budget, a one-shot is dropped and logged as `oneshotDropped`. Narration, stems and beds are never dropped.
   - Add a spike-screen toggle, **"Stress: B·S1 load"** (37 pending, 300 s ahead, budget 40), for T1b.
5. **Click-free gain changes.**
   - Use `param.cancelAndHoldAtTime(now)` if react-native-audio-api 1.0.1 has it.
   - Otherwise, keep a shadow of each param's automation (from-value, to-value, t0, t1). Compute the live value, and call `setValueAtTime(live, now)` right after `cancelScheduledValues(now)`.
   - Never read `param.value` to start a ramp.
   - Crossfades: one equal-power `setValueCurveAtTime` per param if it's available; otherwise ramp from the shadow value.
   - Never stop an audible source without a fade of at least 20 ms.
6. **Fade, then suspend.**
   - Applies to `pauseNarration`, Stop all, route-unplug and an interruption's `began`.
   - Ramp the master to silence over 250 ms (500 ms for Stop all). Suspend once that fade has rendered. Schedule the suspend from a silent source that ends when the fade does, not from a timer.
   - Resume: resume the context with the master silent, then ramp up over 300 ms (1 s after an interruption).
7. **Audio focus and interruptions.**
   - Find out how 1.0.1 requests and re-requests focus on Android: `observeAudioInterruptions('gain')`, the `duck` event and anything else.
   - Re-request focus every time playback starts or resumes. Confirm with `adb shell dumpsys audio` (the focus stack) that InTell holds it while playing.
   - Subscribe to `duck`. Log every raw `interruption` and `duck` payload.
   - `began`: fade and suspend (item 6).
   - `ended` with `shouldResume`: resume at once (item 6), but only if an interruption caused the pause.
   - `ended` with no `began`: log `interruptionUnpaired` and do nothing.
   - If the library can't hold or regain focus reliably, say so in the report. It counts against the library.
8. **A tour loop for T1.** While the mix runs, start the 90 s narration every 3 minutes of **audio-clock** time, driven by the heartbeat. Ducking, release and `onEnded` then all run while the phone is locked. Log each start and end.
9. **A release build with the spike.**
   - The spike route redirects when `!__DEV__`. Also allow it when `EXPO_PUBLIC_AUDIO_SPIKE=1` at build time. Never enable it in store builds.
   - Build and install with `npx expo run:android --variant release`. In PowerShell, run `$env:EXPO_PUBLIC_AUDIO_SPIKE="1"` first.
   - `run-as` doesn't work on release builds. Export the log with the spike's Share button, or write it to app-specific external storage so `adb pull /sdcard/Android/data/org.replaceplace.intell/files/…` works.
10. **Diagnostics.** Log one row per minute and keep the rest in memory.
    - Fields:
      - `activeVoices`, `pendingOneShots`
      - `nodesCreated`, `nodesReleased`, `missedEnded`, `oneshotDropped`
      - `clockRate` (Δcontext ÷ Δwall over the last window), `clockGapMs`
      - `decodedBytes`, `contextState`, `appState`, `route`, focus state
    - Watchdog: log `audioHealth: degraded` when `clockRate` is below 0.98 for two windows in a row.
    - **Log only. No self-healing in B·S2;** we want the raw behavior.

**Checks before Part 2:**
- `pnpm test`, `pnpm typecheck` and `pnpm lint` pass.
- Unit tests cover the `VoiceLedger` and the scheduler. After every scenario, created = released + live. Include Stop all during a fade, and a cancel before start.

## Part 2: smoke check (Lane B alone, about 15 minutes)
1. Install the release build and cold-launch it straight into `intell://dev/audio-spike`, so the map home isn't mounted.
2. Start the mix, lock the phone for 10 minutes, then unlock and stop.
3. Report:
   - `clockRate` per minute
   - `activeVoices`, which should never go over 12 plus the 2 heartbeats
   - `nodesCreated − nodesReleased` after Stop, which should be the heartbeats only
   - `missedEnded`
4. **Stop and report to Jordan before the full run** if `clockRate` drops below 0.99 or nodes leak.

## Part 3: the full protocol with Jordan (Android run 2)
**Setup:** the same as B·S1: Bluetooth earbuds, unplugged, Wi-Fi `adb`, volume at 50%, Do Not Disturb except calls. Release build, cold-launched into the spike.

**Order:** **T1 first** (60 minutes, with the tour loop), then T3, T4, T6 and T7, and T5 whenever the caller is ready.

- **During T1, at minutes 5, 15, 30, 45 and 60** (over Wi-Fi `adb`, with the phone still locked), save each as `docs/spikes/logs/bs2-adb-<minute>.txt`:
  - `dumpsys meminfo org.replaceplace.intell` (T8)
  - `dumpsys media.audio_flinger` (the underrun count for InTell's track)
  - `top -H -b -n 1 -p <pid>` (the 10 busiest threads)
  - `dumpsys activity processes org.replaceplace.intell` (process state and scheduling group)
  - `dumpsys thermalservice` (thermal status)
  - also `dumpsys battery` at the start and the end (T9)
- **T1b stress** (informational; 10 minutes, after T1): the same build with "Stress: B·S1 load" on. This shows how much headroom a release build has while locked.
- **T6 in detail:**
  1. Start a song in another app while InTell plays. InTell should fade and pause, and `dumpsys audio` should show the other app at the top of the focus stack.
  2. Stop the song, return and press play. InTell should regain focus and resume cleanly.
- **One extra T8 reading** (informational): with the map home open underneath, the real-world case.
- **Pass bars are unchanged** from `M1-audio-test-results.md`:
  - T1: no clock jump over 50 ms, and total growth under 250 ms.
  - T8: total PSS under 150 MB, with no steady climb.

## Part 4: narration memory probe (informational, Lane B alone)
AUDIO_SPEC §6 ships narration as AAC. `decodeAudioData` turns it into 32-bit float PCM: 5 minutes of mono at 48 kHz is about 58 MB.

Find out what 1.0.1 offers to avoid that:
- a sample-rate option for `decodeAudioData`
- `AudioBufferQueueSourceNode` (a file played in chunks)
- `StreamerNode`: does it accept local files, and does it pull in FFmpeg?

Generate a 5-minute mono AAC test file (a tone sweep or noise is fine). For each option that exists, measure the decode time, `decodedBytes` and PSS. Report the numbers; don't wire anything into the engine.

## Record
- **`docs/spikes/M1-audio-test-results.md`:** add an **"Android run 2"** column, and keep run 1.
- **The logs:**
  - `docs/spikes/logs/pixel11-<date>-run2.jsonl`, with device names redacted as before
  - the `bs2-adb-*.txt` snapshots
- **ADR 0001:** a dated "Android run 2" bullet under Findings. **Leave the Status as it is.**

## Next
Write `docs/briefs/BS2-report.md`, starting with `Lane B · B·S2`. Cover:
- the fixes, with commit hashes
- the smoke-check numbers and the results table
- a clock-rate table per 5 minutes for T1 and T1b
- the `adb` highlights (underruns, busiest threads, process state, thermal) and memory
- the narration probe
- anything surprising

Then push with `git push -u origin b/bs2-audio-stability`. Open **one PR** titled "B·S1 + B·S2: ADR 0001 Android audio test". It carries the B·S1 commits too, since B·S1 never got a PR. Stop for Claude's review.
