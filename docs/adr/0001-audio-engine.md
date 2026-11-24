# ADR 0001 — Audio engine (`react-native-audio-api`)

## Status
**Proposed (awaiting device results)**

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

**Verdict:** _Pending_ (Android protocol **run**; several fails — Status unchanged for Claude)

## Findings so far
(Status remains **Proposed**. Full T1–T9 protocol and iPhone testing are postponed.)

- **Pixel 11 smoke tests passed:** all layers (narration, 3-stem music, bed, one-shots), ducking, Bluetooth route detection, locked-screen playback with the lock-screen notification, and **~60.5 MB** decoded with **0** cache evictions.
- **JS timers pause in the background on Android, but engine `onEnded` callbacks still reach JS.** A locked period froze `setInterval` (no 60-second diagnostics until return to `active`); native audio kept playing; `voiceEnded` fired while backgrounded and can top up schedules / write diagnostics.
- **Design rule:** schedule sound ahead on the **audio clock** (`start(when)`); drive background logic from **engine callbacks** and **location events** — never from `setInterval` alone.
- **Spike ≠ product ambience params.** The spike’s one-shot interval is a **fixed 8 s** and its gain is a **fixed −12 dB** (simplifications). M4 shared ambience logic must use the spec’s **random (exponential) intervals** and **gain ranges** (AUDIO_SPEC).
- **Outstanding:** Claude’s read of the Android T1–T9 results (Accept / Reject / more work); the iPhone build and test.
- **Clock-gap interpretation.** `clockGapMs` = wall elapsed since mix start − context elapsed since mix start. Growing positive gap ⇒ dropouts / audio-clock starvation; slight negative drift ⇒ clock-rate difference, not a failure by itself.
- **Android protocol (B·S1, 2026-11-23):** First attempt blocked by Metro custom `resolveRequest` breaking existing spike WAV asset ids. Fix: install the missing-fixture sentinel resolver only when WAVs are absent (`6330c67`). Protocol then run on Pixel 11 + Bluetooth earbuds. **T4/T5 pass; T1/T2/T3/T6/T7/T8 fail; T9 −13%.** Dominant issue: continuous mix quality collapses under lock (and degrades with interaction) while layers keep playing; `clockGapMs` grows to ~1.7e6 ms; PSS ~500–600 MB. Log: `docs/spikes/logs/pixel11-2026-11-23.jsonl`. Details in `docs/briefs/BS1-report.md`. Status remains **Proposed**.

## Consequences
- UI never imports `react-native-audio-api` (ESLint `no-restricted-imports`).
- Decode LRU cap for the spike is **96 MB**; product may retune after memory data.
- Product ambience one-shot scheduling must not rely on JS timers alone while locked; schedule on the audio clock and wake from engine / location callbacks.
- iOS cloud build needs JoJo to run `eas init` (Expo account) before `eas build` — not done by the spike agent.
