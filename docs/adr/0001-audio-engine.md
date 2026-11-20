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
| T1 | 60-minute locked run + clock health | | | clockGapMs stable (no jumps &gt; 50 ms; total growth &lt; 250 ms) |
| T2 | Stem alignment (ear) | | | no audible flams (maxStemDriftMs not measurable in Web Audio) |
| T3 | Ducking | | | |
| T4 | Route switching | | | pause on unplug |
| T5 | Phone call | | | |
| T6 | Other app audio | | | |
| T7 | Lock-screen controls | | | |
| T8 | Memory &lt; 150 MB | | | |
| T9 | Battery (informational) | | | |

**Verdict:** _Pending_

## Findings so far
(Android device spike, before the 60-minute protocol run is complete.)

- **Background JS timers stop.** With the screen locked, React Native JS timers do not fire on Android. A 43 s locked period produced no 60-second diagnostics line until return to `active`. Native audio (AudioContext graph) kept playing; only timer-driven JS work (periodic logging, previously `setInterval` one-shots) stalled.
- **Pre-schedule one-shots on the audio clock.** Random one-shots are planned with a seeded RNG (`OneShotWindowScheduler` in `@intell/shared`) and scheduled with `AudioBufferSourceNode.start(when)` for a rolling **5-minute** horizon ahead of `audioContext.currentTime`. The window is topped up whenever JS wakes (AppState change, route / interruption / remote / notification / `onended`). Pending one-shots are cancelled on Stop. This keeps surroundings events going while JS is frozen.
- **Clock-gap interpretation.** `clockGapMs` = wall elapsed since mix start − context elapsed since mix start.
  - **Growing positive gap** (wall ahead of the audio clock) indicates dropouts / audio clock starvation.
  - **Slight negative drift** is a clock-rate difference between wall time and the audio clock, not a failure by itself.

## Consequences
- UI never imports `react-native-audio-api` (ESLint `no-restricted-imports`).
- Decode LRU cap for the spike is **96 MB**; product may retune after memory data.
- Product ambience one-shot scheduling must not rely on JS timers alone while locked; prefer audio-clock pre-scheduling (or another native wake path confirmed by spike logs).
- iOS cloud build needs JoJo to run `eas init` (Expo account) before `eas build` — not done by the spike agent.
