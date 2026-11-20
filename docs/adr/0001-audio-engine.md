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

## Consequences
- UI never imports `react-native-audio-api` (ESLint `no-restricted-imports`).
- Decode LRU cap for the spike is **96 MB**; product may retune after memory data.
- iOS cloud build needs JoJo to run `eas init` (Expo account) before `eas build` — not done by the spike agent.
