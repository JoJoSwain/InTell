# M1 audio spike: architect review of the plan

**Plan reviewed:** `docs/briefs/M1-audio-spike-plan.md`
**Verdict:** **APPROVED with the changes below.** Start at Phase 0. Where this review conflicts with the plan or the brief, this review wins.
**Reviewer:** architect (Claude), 2026-11-19

The plan is strong. The capability research is cited, the install set stays within the brief, and the Android `currentOutputs` caveat was a good catch. The changes below fix two measurement and size problems and answer every question in §6.

---

## Required changes

### R1. Stem drift: don't log a fake number
Web Audio has no per-source playback position, so a `maxStemDriftMs` computed from scheduled times would always read ~0 and prove nothing. Instead:
- **Remove `maxStemDriftMs`** from the logged diagnostics, or set it to `null` with the comment "not measurable in Web Audio". Keep the field optional in the shared interface: `maxStemDriftMs?: number | null`.
- **Stem alignment is proved by ear** (the T2 flam test). That's what the click design is for.
- **Add a clock-health metric instead.** It detects the real risk: the OS silently pausing or starving audio while the screen is locked. Each minute, log `contextTimeMs` (`AudioContext.currentTime × 1000`), `wallElapsedMs` (time since mix start, from `Date.now()`), and `clockGapMs = wallElapsedMs − contextTimeMs` (allowing for the start offset). A steadily growing `clockGapMs` (> 250 ms over 60 minutes), or a jump > 50 ms between two lines, is a **fail signal** for T1. Log `audioContext.state` too.
- Update the Appendix A results template: in T2, replace "logged drift ≤ 5 ms" with "no audible flams"; T1 gains "clockGapMs stable (no jumps > 50 ms; total growth < 250 ms)".

### R2. Fixture sizes: the brief's numbers would be ~55 MB
At 44.1 kHz/16-bit, a 3-minute narration, 3 × 32 s stereo stems and 2 × 60 s stereo beds come to about 55 MB, over the 25 MB budget. Use these instead:

| File | Change |
|---|---|
| `narration_*.wav` | **90 s**, mono, **22.05 kHz** (the test playlist loops it) |
| `stem_a/b/c.wav` | **16.000 s** (8 bars at 120 BPM), stereo, 44.1 kHz. Shorter loops wrap more often, which makes the alignment test stricter |
| `bed_wind/water.wav` | **30 s**, stereo, **22.05 kHz**, seamless |
| `oneshot_1..6.wav` | as planned |

Target **< 20 MB** on disk. Also **don't commit the generated WAVs**:
- gitignore `apps/mobile/assets/spike-audio/*.wav`
- commit the generator, plus a script `pnpm --filter @intell/audio-fixtures generate` (or similar)
- document "run the generator before building" in the spike README and the build notes
- make the test screen show a clear message if the assets are missing, rather than crashing at bundle time if that's avoidable (a sentinel file is fine)

### R3. Decode-cache size must fit the full mix
Decoded audio lives in memory as 32-bit float at the context's sample rate, so the working set for the full mix is about 50–65 MB decoded. With a 64 MB LRU cap, the cache could evict buffers mid-mix and cause re-decodes and stutters.
- For the spike, set the cap to **96 MB**.
- Add `decodedBytes` (the current LRU total) and `cacheEvictions` to `EngineDiagnostics` and the JSONL log. Memory under 150 MB is a pass criterion, and we need to see how much of it is ours.

### R4. Small additions
- Diagnostics also log `appState` (active or background), `contextState`, `route` and `notificationVisible`.
- On engine init, call `getDevicesInfo()` once so the first log line has a route.
- `DuckingPolicy` exports `afterglowMs = 8000` as a **constant only**, with no behavior (§6.7).

---

## Answers to §6

| # | Question | Decision |
|---|---|---|
| 1 | Where the interface lives | **`packages/shared`, as the brief says.** In this branch, also update the path comment in AUDIO_SPEC §2.2 (one-line doc fix) |
| 2 | Fallback on failure | **Follow the brief:** record Rejected in ADR 0001 and stop. The fallback gets its own brief |
| 3 | Android route mapping | **Approved:** heuristic mapping from `availableOutputs`/category/name, with `'unknown'` as the fallback. Log the raw `getDevicesInfo()` payload on every `routeChange`, so we can improve the mapping from real Pixel data. Escalate only if T4 can't tell headphones from speaker at all |
| 4 | `POST_NOTIFICATIONS` | **Approved:** add it to the plugin permissions and request it at spike start on Android 13+. (The product will need the same thing for the exploring session in M6.) |
| 5 | Lock-screen pause | **Approved:** pause suspends the whole `AudioContext`. In the product, pausing from the lock screen should pause the whole experience, not just the narrator |
| 6 | Headphone unplug | **Pause on unplug.** When headphones or Bluetooth disconnect (`OldDeviceUnavailable` / `routeChange` to speaker), suspend the context and set the notification to paused. This is standard platform behavior, and it's required by our wildlife-safety rule: never suddenly blast audio out of the speaker on a trail. Log it. Add a one-line note to ADR 0001 that AUDIO_SPEC §2.1 needs this rule written in (the doc change happens with the ADR) |
| 7 | Afterglow | Constant only (R4) |
| 8 | Underruns | Omit if the library gives no signal; the clock-health metric (R1) covers this |
| 9 | EAS `projectId` | **Don't run `eas init` or any credentialed command.** Document that JoJo runs `eas init` (Expo account) before the iOS build. The Android local build doesn't need it |
| 10 | Branch name | `m1-audio-spike` from `origin/master` |

---

## Unchanged from the plan (approved as written)
Phase 0 order; Parts A–G structure; the install set (`react-native-audio-api`, `expo-dev-client`, `expo-file-system` via `pnpm exec expo install`); plugin config keys (verify against the installed plugin's schema); the ESLint import restriction; no AAC conversion unless decoding fails on a device; the iOS steps documented but not run.

## Report back with (in addition to the brief's list)
- The installed `react-native-audio-api` version, and any doc differences found after installing
- The fixture total size on disk
- A first JSONL line from an Android run (if a device is connected); otherwise say so
