# M6 brief (Lane B): narration, session, proximity and QR on the phone

**Lane:** B (Mobile) · **Branch:** `b/m6-narration-session`, cut from `master` at `e03d662`. This brief is its first commit. · **Plan first:** write `docs/briefs/M6-plan.md`, push, open the PR, and stop for Claude's plan review.

**What M6 is:** the first real listening experience. You walk into a grove, and stories play by themselves as you reach them. M6 wires together pieces that already exist and are tested:
- **A4's** `sessionStep` (the session state machine)
- **A6's** `directorStep` (the AudioDirector)
- **The engine** `RNAudioApiEngine`, plus the **`audio-session`** module from B·S3 (both proven on the Pixel)
- **The packs** M5a installs

M6 doesn't re-implement the rules in `packages/shared`; it calls them. **Lane B owns `apps/mobile`. Changes to `packages/shared` go through Claude** (flag them in the plan).

**Sources:**
- BUILD_PLAN M6 (its build list and acceptance criteria)
- PRODUCT_SPEC §5.1 and FR-3 to FR-8
- TECH_SPEC §3.1–3.3
- AUDIO_SPEC v4
- ADR 0001 (the decision after Android run 2, the engine rules, the open items) and ADR 0006
- `docs/design/MOBILE_HOME_STANDARDS.md`
- the A4 and A6 module headers (their public APIs)
- `BS2-report.md` and `BS3-report.md`

## Build
**1. The session shell.**
- Feed `sessionStep` real events:
  - location fixes, from the location service
  - QR scans
  - narration ends, pauses and resumes, from the engine and the session module
  - a `tick` from the audio-clock heartbeat
  - settings changes, and Day/Night changes from the time window
- Carry out every effect it returns:
  - **SQLite writes:** completions, progress, unlocks, met characters, visits
  - **The location mode**
  - **Teasers in the UI**
  - **`play` and `stopNarration`**, passed to the AudioDirector
- Persist the session state to `kv` after each step (with `parseSessionState`), and resume from it after the OS kills the app.

**2. The AudioDirector.**
- Feed `directorStep` the session's effects, `storyStateOf`, location, the heartbeat, engine events and settings. Apply its commands to `RNAudioApiEngine`.
- Persist its state beside the session state.
- **In M6, only narration and its moments are switched on:** narration, ducking, the afterglow resolve, the threshold motif, the locked teaser and interruption resume. Surroundings, music, beacons and Hush stay switched off (a director world flag) until M7.
- Narration loads at 24 kHz, with the memory policy.

**3. The session module.** The `audio-session` focus machine, `MediaSession` and the notification come from B·S3. Hook them into the director's `interruption`, `settings.route` and `suspend`/`resume` paths.
- The lock-screen title shows the playing fragment's title.
- Back skips 10 s.
- Shorten B·S3's remote-play resume to about 2 s if you can do it safely.

**4. Location.**
- `expo-location` in the foreground with no session.
- Background updates during a session, kept running on Android by a foreground service.
- **Decide in the plan:** one service with the types `mediaPlayback|location`, or two. Follow Android 14+ and 17 rules: start it from a user-visible state, with while-in-use (Android 17 audio hardening applies to audio).
- Modes come from the session's `setLocationMode`: foreground, balanced, high or idle.
- Location stops within 5 s of the session ending.
- **No coordinates in logs or analytics.**

**5. QR physical markers.**
- Universal and app links on `LINK_DOMAIN` (`/f/{code}`): upper-case the code, hash it with sha256, match it against the pack's `markerHash`, and send `scan` to the session.
- The link domain (`intell.replaceplace.com`) **isn't set up yet.** Plan the intent filter and the `assetlinks.json` content, and list the hosting step for Jordan. Use a custom-scheme fallback for testing until it exists.

**6. The playing overlay and the teaser.**
- Over the map home: the fragment's title and tier, its progress, pause and play, and back 10 s. There's **no Play button to start a story**; narration always starts from an event.
- The afterglow state, and the teaser sheet: the locked teaser text, the change teaser, and the "come back at night" hint.
- Follow MOBILE_HOME_STANDARDS where it applies. Where it doesn't, propose a minimal design in the plan (a sketch or a description). **Claude checks it with Jordan before it's built.**

**7. Packs.** Switch the app's pack parsing to **`GrovePackDevice` / `RegionPackDevice`**, the forward-compatible parsers from A5. This is required before any pack carries the new keys.

**8. The accessible trigger and the settings it needs:** the accessible trigger (a single fix within 35 ft), location availability, and beacons on or off (stored for M7). Minimal Settings rows only; the full Settings Audio page is M7.

## Tests
- **Unit and integration tests** for the shell: the event mapping, each effect being carried out, persistence and resume, and the queue (two triggers never overlap).
- **The demo GPX walk on the Android emulator** (mock locations), meeting **every BUILD_PLAN M6 acceptance item**:
  - each unlocked fragment plays once, in tier order
  - locked ones never play
  - a contingency replays, and a correction doesn't
  - a Day-only fragment is silent at night
  - a locked marker's scan shows its teaser
  - no overlap
  - no tap needed to start narration
  - with location denied, scans still work, and proximity and the accessible trigger are off
  - the accessible trigger fires at 35 ft
  - location stops within 5 s of the session ending
- **iOS:** the BUILD_PLAN's iOS simulator item is deferred; there's no Mac or Apple account yet. Say so in the report.
- **A short device walk with Jordan on the Pixel,** at the end, with the phone in a pocket and locked: real triggers, the lock-screen controls, and a call mid-story.

## Accept when
- [ ] `pnpm lint`, `typecheck` and `test` pass, and both CI jobs are green.
- [ ] Every BUILD_PLAN M6 acceptance item passes on the Android emulator, and the device walk passes.
- [ ] No coordinates appear in logs, effects or analytics.

## Out of scope
- Surroundings, music, beacons, Hush and the Settings Audio page (M7)
- Chronicle (M8)
- iOS builds

## Plan (stop after this)
`docs/briefs/M6-plan.md` covers:
- the module layout in `apps/mobile`
- how events and effects map, and the persistence and resume design
- how the director is wired, and the M6 layer flags
- the location-service design (one foreground service or two, the permissions, Android 14+ and 17 rules)
- the QR and link plan, with Jordan's hosting steps
- the overlay design proposal
- the switch to the device parsers
- the test plan (emulator GPX plus the device walk)
- the order of work
- spec gaps and any `packages/shared` changes needed (flag them; don't guess)

Push with `git push -u origin b/m6-narration-session`, open a PR titled "M6: narration and session (plan)", and **stop for plan review.**
