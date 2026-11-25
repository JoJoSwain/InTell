# ADR 0001 — Audio engine (`react-native-audio-api`)

## Status
**Accepted for Android as the renderer, with a native `audio-session` module (2026-11-24). iOS pending.**

## Context
AUDIO_SPEC §2.1 requires continuous locked-screen playback (60 minutes), lock-screen / now-playing controls, route detection (headphones / Bluetooth / speaker), and polite interruption handling, while mixing narration, synced music stems, ambience beds and one-shots with bus ducking.

The primary candidate is Software Mansion’s `react-native-audio-api` (Web Audio–style graph). BUILD_PLAN M1 and brief `docs/briefs/M1-audio-spike.md` require a device spike before any other audio work. If the spike fails, do **not** build the Expo Module fallback in this ADR’s code phase — record *Rejected* and stop; the fallback gets its own brief.

**Interface location:** types live in `packages/shared` (so admin Web Audio can share the contract). Implementation: `apps/mobile/src/audio/engine/RNAudioApiEngine.ts`.

**Doc note (review §6.6):** when this ADR is Accepted or Rejected, AUDIO_SPEC §2.1 should gain an explicit rule that headphone / Bluetooth unplug pauses playback (wildlife-safety: never suddenly blast the speaker on a trail). The spike already implements pause-on-unplug.

## Decision (pending results)
Adopt `react-native-audio-api` as the mobile `AudioEngine` **if** Appendix A device tests pass on a real Android **and** a real iPhone. Otherwise reject and commission the Expo Module fallback brief.

## Options under test
| Option | Notes |
|---|---|
| A. `react-native-audio-api` + Expo config plugin | Under test (installed version recorded in the spike report) |
| B. Custom Expo Module (AVAudioEngine / Oboe) | Fallback only — out of scope for this spike |

## Results (fill after JoJo’s device protocol)

Copy from `docs/spikes/M1-audio-test-results.md`.

| # | Test | Android | iOS | Notes |
|---|---|---|---|---|
| T1 | 60-minute locked run + clock health | **fail** | | lock → immediate/severe distortion; `clockGapMs` → ~1.7e6 ms |
| T2 | Stem alignment (ear) | **fail** | | too degraded under lock to judge |
| T3 | Ducking | **fail** | | clicks/choppiness after toggles |
| T4 | Route switching | **pass** | | BT unplug pauses; stayed paused |
| T5 | Phone call | **pass** | | paused and resumed |
| T6 | Other app audio | **fail** | | did not pause; distorted |
| T7 | Lock-screen controls | **fail** | | pause ok; locked audio garbage |
| T8 | Memory &lt; 150 MB | **fail** | | PSS ~500–600 MB |
| T9 | Battery (informational) | 89%→76% (−13%) | | unplugged ~60 min |

**Verdict:** Accepted for Android as the renderer, with a native `audio-session` module (see the decision after Android run 2). iOS run pending.

## Findings so far
(Status remains **Proposed**. Full T1–T9 protocol and iPhone testing are postponed.)

- **Pixel 11 smoke tests passed:** all layers (narration, 3-stem music, bed, one-shots), ducking, Bluetooth route detection, locked-screen playback with the lock-screen notification, and **~60.5 MB** decoded with **0** cache evictions.
- **JS timers pause in the background on Android, but engine `onEnded` callbacks still reach JS.** A locked period froze `setInterval` (no 60-second diagnostics until return to `active`); native audio kept playing; `voiceEnded` fired while backgrounded and can top up schedules / write diagnostics.
- **Design rule:** schedule sound ahead on the **audio clock** (`start(when)`); drive background logic from **engine callbacks** and **location events** — never from `setInterval` alone.
- **Spike ≠ product ambience params.** The spike’s one-shot interval is a **fixed 8 s** and its gain is a **fixed −12 dB** (simplifications). M4 shared ambience logic must use the spec’s **random (exponential) intervals** and **gain ranges** (AUDIO_SPEC).
- **Outstanding:** the `audio-session` module and B·S3 (T4–T7, T5 re-run); then the iPhone build and test.
- **Clock-gap interpretation.** `clockGapMs` = wall elapsed since mix start − context elapsed since mix start. Growing positive gap ⇒ dropouts / audio-clock starvation; slight negative drift ⇒ clock-rate difference, not a failure by itself.
- **Android protocol (B·S1, 2026-11-23):** First attempt blocked by Metro custom `resolveRequest` breaking existing spike WAV asset ids. Fix: install the missing-fixture sentinel resolver only when WAVs are absent (`6330c67`). Protocol then run on Pixel 11 + Bluetooth earbuds. **T4/T5 pass; T1/T2/T3/T6/T7/T8 fail; T9 −13%.** Dominant issue: continuous mix quality collapses under lock (and degrades with interaction) while layers keep playing; `clockGapMs` grows to ~1.7e6 ms; PSS ~500–600 MB. Log: `docs/spikes/logs/pixel11-2026-11-23.jsonl`. Details in `docs/briefs/BS1-report.md`. Status remains **Proposed**.
- **Android run 1, Claude's analysis (2026-11-23):** B·S1 is a valid fail of the **spike**, not yet a fair test of the **library**. The spike broke AUDIO_SPEC §2.1's budget and basic lifecycle rules:
  - **Too many voices:** 42 live voices at mix start (37 one-shots queued 5 minutes ahead), against a budget of 12.
  - **Leaks on Stop:** 12–21 voices leaked on every Stop (42 → 63 → 84 over three starts of one engine), and finished nodes were never disconnected.
  - **JS timers:** cleanup and resume ran on JS timers, which don't run while locked.
  - **Clicks:** ramps restarted from stale values (T3).
  - **Cut fades:** an immediate suspend cut the fades.
  - **Focus:** no `duck` handling (nine unpaired `ended` events) and no confirmed focus hold (T6).
  - **Build:** a debug build with the map stack mounted.

  The clock shows the effect, as context seconds per wall second:

  | Load | Screen | Clock speed |
  |---|---|---|
  | 63 voices | unlocked | 99% |
  | 61 voices | locked | 64% → 39% over 20 minutes |
  | 82–84 voices | locked | 31% → 23% over 34 minutes |

  Brief `docs/briefs/BS2-audio-stability.md` fixes the spike and re-runs the protocol on a **release** build.
- **Android run 2 (B·S2, 2026-11-24):** Release spike on Pixel 11 + Bluetooth earbuds. **T1/T2/T3 pass** (clean 60 min locked; `clockRate` ~0.9998–1.0008; underruns flat 80→80; PSS ~155–171 MB). **T4/T5/T6/T7 partial** — pause-on-unplug / pause-on-interruption work; **resume after reconnect, other-app audio, and phone call does not** (`shouldResume: false` on `began`; no `resumeAfterFade` observed; Start often disabled until Stop→Start). Lock-screen metadata OK; pause control missing; play auth-gated. **T1c informational FAIL:** MediaElement bed `onLoad` thrash, PSS → ~1.1 GB / 10 min, zero loop events — path not viable as implemented (do not fix in B·S2). First T1 attempt SIGSEGV in `markDeletions`/`isPaused` after mid-mix MediaElement connect; not reproduced after gating MediaElement behind T1c; **M6 rule:** delay `disconnect` until after `onEnded` / ≥1 quantum after `stop`. Crossfade `setValueCurveAtTime` overlap → JS fatal — **M6:** cancel overlapping curves. Details: `docs/briefs/BS2-report.md`. Logs: `docs/spikes/logs/pixel11-2026-11-24-run2.jsonl`, `bs2-adb-*.txt`. Status remains **Proposed**.
- **Decision after Android run 2 (Claude, 2026-11-24): Accepted for Android as the audio *renderer*, with a native session module. iOS still pending.**
  - **Why:** the render path passed decisively on a release build: a clean 60 minutes locked, `clockRate` 0.9998–1.0008, no new underruns, voices balanced, about 160 MB PSS. T1b held at 38–40 voices.
  - **The failures are all platform-session:**
    - resume after an interruption, a phone call or a route change
    - lock-screen and earbud controls
    - library gaps: no `duck` event, `shouldResume: false` on transient losses, and no `ended` after a call
  - Under the rule set before the run, that calls for a native session module beside the library, not the full fallback.
- **Architecture:**
  - `react-native-audio-api` renders the mix: the graph, buses, scheduling and decoding.
  - A small **Expo Module, `audio-session`** (Kotlin now, Swift when iOS is tested), owns the platform session. Turn off the library's own session handling (`AudioManager.disableSessionManagement()` and the notification manager).
  - **The module handles:**
    - **Audio focus:** request and abandon, with the full mapping: `GAIN`, `LOSS`, `LOSS_TRANSIENT` (→ `shouldResume: true`) and `LOSS_TRANSIENT_CAN_DUCK` (→ `duck`). It also re-requests focus on resume.
    - **A `MediaSession`** with a media-style notification and the media-playback foreground service: play, pause, skip back 10 s, and metadata, from the lock screen, the notification and the earbuds.
    - **Becoming noisy:** pause on unplug, never auto-resume.
  - The AudioDirector (A6) consumes its events.
- **Required engine rules for M6** (from B·S2):
  - Delay `disconnect` until after `onEnded`, or at least one quantum after `stop`.
  - Never connect a source into the live graph as a side effect of preloading.
  - Cancel an overlapping automation curve before scheduling a new one.
- **B·S3 / Android run 3 (2026-11-24):** Expo Module `audio-session` (Media3 `SimpleBasePlayer` + `DefaultMediaNotificationProvider` + JS focus machine); library session disabled. **T4/T5/T7 pass; T6 pass*** (YT Music pause; IG duck then LOSS; Pixel AudioHardening can deny focus → “audio busy”; Start full mix recovered); **15‑min T1 pass** (`clockRate` ~0.9998–1.0001, same pid, focus held). See `docs/briefs/BS3-report.md`. **Status unchanged** (Accepted for Android renderer + session module).
- **Open items:**
  - **Bed streaming:** the library's MediaElement path isn't viable (T1c). Beds decode within the LRU cap for now, and streaming is revisited in M7, with a native streamed bed player as one option.
  - **Memory:** about 155–171 MB against the 150 MB bar. Re-measure in M6 with real assets and the map mounted, then set the whole-app target.
  - **Gate:** M6 ships only after the session module passes T4–T7 and T5 on the Pixel (a B·S3 re-run). **B·S3 run 3 met that gate on Pixel**; Claude to confirm before M6.

- **Decision rule for Android run 2** (set before the run):
  - If the **render** still fails (T1 or T3), record **Rejected** and commission the fallback brief. No further tuning rounds.
  - If only **platform-session** items fail (T6 focus, T7 controls), Claude chooses between a small native session module alongside the library and the full fallback.
  - If Android passes, the iPhone run decides adoption, as before.
- **Library observations so far:**
  - `onEnded` is unreliable for sources stopped before they start; some never fire.
  - No underrun counter is exposed.
  - `decodeAudioData` holds 32-bit float PCM, so narration needs streaming or just-in-time decoding (B·S2 Part 4 probes the options).
- **Engine operating rules** (any engine, learned from B·S1):
  1. A hard source budget (12, per AUDIO_SPEC §2.1), enforced by the engine.
  2. Schedule on the audio clock, just in time (no more than 20 s ahead), woken by an audio-clock heartbeat. No JS timers in the audio path.
  3. Every node is released and disconnected exactly once, and the engine can prove it (created = released + live).
  4. Fade before every stop or suspend.
  5. Request focus explicitly, and re-request it on every start and resume.
  6. Test release builds, locked, for 60 minutes, with objective counters (clock rate, AudioFlinger underruns), not only by ear.

## Consequences
- UI never imports `react-native-audio-api` (ESLint `no-restricted-imports`).
- Decode LRU cap for the spike is **96 MB**; product may retune after memory data.
- Product ambience one-shot scheduling must not rely on JS timers alone while locked; schedule on the audio clock and wake from engine / location callbacks.
- iOS cloud build needs JoJo to run `eas init` (Expo account) before `eas build` — not done by the spike agent.
