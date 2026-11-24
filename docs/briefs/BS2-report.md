# Lane B · B·S2

Android run 2 of the ADR 0001 protocol on Pixel 11 (Android 17) + Beats Studio Buds + Bluetooth. Release spike (`EXPO_PUBLIC_AUDIO_SPIKE=1`). Branch `b/bs2-audio-stability`.

## Fixes (commits)

| Commit | What |
|---|---|
| `d850a0b` | shared: VoiceLedger + short one-shot look-ahead |
| `350da55` | heartbeat engine, click-free gain, fade-then-suspend |
| `fe59a58` | spike budget/settled logging + memory probe screen |
| `98a5523` | Part 4 probe notes + short loop fixture |
| `a09f606` | T1c MediaElement bed + 24 kHz narration decode |
| *(this PR tip)* | MediaElement mount gated behind T1c; `prepareMixStart` restores master gain after stop |

## Smoke (Part 2)

Release locked smoke cleared by Claude before Part 3. Duck gap / settled diagnostics tweaks included.

## Results (Android run 2)

See `docs/spikes/M1-audio-test-results.md` (run 2 column). Summary:

| # | Run 2 | Notes |
|---|---|---|
| T1 | **pass** (subjective + clock/underrun) | 60 min locked, same pid; no audible degradation. `clockRate` ~0.9998–1.0008. AudioFlinger underruns flat **80→80** (min 5→60). PSS ~171→153→155→155→159 MB (stable; slightly over 150 MB bar). End battery **49%**. |
| T1b | informational | Stress ON 10 min: PSS 158→174 MB; `clockRate` ~0.997–1.000; ~38–40 voices; budget drops expected. |
| T1c | informational **FAIL** | MediaElement bed not viable as implemented (below). |
| T2 | **pass** | No flams / doubled clicks reported during T1. |
| T3 | **pass*** | Ducking smooth. *Loud chirp at narration start is in `narration_90s.wav` (peak ~0.79–0.86 in first 20–100 ms), not the duck cycle. |
| T4 | **partial** | Unplug → `route-unplug` pause **pass**. Reconnect stays paused **pass**. Play-after-reconnect **fail**: earbud play no-op; lock-screen play blocked by phone auth; notification play stayed disabled; only Stop→Start recovers. **Zero** `resumeAfterFade` in log. |
| T5 | **partial** | Call → `interruption` `began` (`shouldResume: false`) → fade/pause **pass**. Hang-up → **no resume** (no `ended` / no `resumeAfterFade`). |
| T6 | **partial** | YT Music → pause **pass**. Pause/close other app → **no resume**; Start disabled until Stop→Start. |
| T7 | **partial** | Metadata “InTell audio spike” **pass**. No pause control shown; play gated by unlock. Audio **clean** while playing (vs B·S1 distortion). |
| T8 | **marginal fail** | T1 PSS ~155–171 MB (bar &lt;150); not climbing. |
| T9 | informational | End **49%** (start charge not captured cleanly for this restart). |

### T1 clockRate (minute samples, restart run)

Representative band **0.99975–1.00042** through the hour (one late sample ~0.9965 at unlock). Far from B·S1’s collapse.

| Approx min | clockRate |
|---|---|
| 5 | ~1.0001 |
| 15 | ~0.9999 |
| 30 | ~0.9999 |
| 45 | ~1.0001 |
| 60 | ~1.0001 |

### adb highlights (T1)

- Process: Dozing, **not frozen**, same pid 17764 for 60 min.
- Underruns on InTell track: **80** at every snapshot (no growth).
- Thermal: no throttling noted in snapshots.
- Snapshots: `docs/spikes/logs/bs2-adb-{5,15,30,45,60}.txt`.

## Classifications (per Claude)

### (1) 10:02 SIGSEGV — library crash, spike trigger

First T1 attempt (~3 min locked): SIGSEGV in `libreact-native-audio-api.so` on the audio thread — `AudioScheduledSourceNode::isPaused` ← `AudioGraph::markDeletions` ← `sortAndCompact`. Immediately prior: late `streamBedReady` while T1c was supposed to be off; MediaElement `preload`/`onLoad` connected a `MediaElementAudioSourceNode` into the live graph mid-mix while JS `releaseVoice` still does immediate `stop()`+`disconnect()`.

**Not reproduced** after gating MediaElement mount behind the T1c toggle.

**M6 required engine rule (not a B·S2 fix):** delay `disconnect` until after `onEnded`, or ≥1 audio quantum after `stop`. Do not connect MediaElement sources into a live graph as a side effect of preload.

### (2) T1c — informational FAIL

MediaElement bed path is **not viable as implemented**:

| | Value |
|---|---|
| PSS | 229 → 654 → **1124 MB** in 10 min (~+874 MB) |
| `streamBedReady` | ~338 (~1/s thrash) |
| `streamBedLoop` | **0** |
| nodesCreated/Released | 482→642 / 476→635 (ledger ~ok — **not** the PSS culprit) |
| clockRate | ~0.9986–1.000 |

`onLoad` repeatedly created MediaElement sources; other apps were LMK’d. **Do not fix in B·S2.** Document only.

### (3) Crossfade `setValueCurveAtTime` overlap — M6

Tapping Crossfade bed while a fade curve was active threw `NotSupportedError` (curve conflict) and killed the JS runtime (`FATAL EXCEPTION: mqt_v_native`). **M6:** cancel the overlapping curve before scheduling a new one.

## Other surprises

- After `fadeMasterAndSuspend` (route-unplug or interruption), **Start full mix** often appears disabled until **Stop all**; recovery is Stop→Start. Matches missing `resumeAfterFade` path when remotes don’t fire.
- Interruptions for YTM and phone call arrived as `began` with **`shouldResume: false`**; no matching `ended` observed on hang-up / other-app stop in this run.
- External spike JSONL mirror path isn’t writable on this device; diagnostics came from logcat.

## Part 4 (memory probe)

See `docs/spikes/BS2-memory-probe.md` / `BS2-T1c-notes.md`. 24 kHz narration decode and MediaElement bed were probed; T1c full-mix path fails as above.

## Logs

- `docs/spikes/logs/pixel11-2026-11-24-run2.jsonl` (from logcat; BT names redacted)
- `docs/spikes/logs/bs2-adb-*.txt`, `bs2-adb-t1b-*.txt`, `bs2-adb-t1c-*.txt`
- `docs/spikes/logs/bs2-interactive-meta.txt`, `bs2-t1-meta.txt`, `bs2-t1b-meta.txt`, `bs2-t1c-meta.txt`

## Decision rule (for Claude)

Render path (T1/T3) **passed** on run 2. Remaining fails are largely **platform-session** (resume after interruption/route, lock-screen controls) plus informational T1c/MediaElement. Status of ADR 0001 left **Proposed**.
