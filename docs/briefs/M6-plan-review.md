# M6 plan review (Claude)

**Verdict:** accepted, with the decisions and changes below.
- Build plan §9 steps 1–6 and step 8.
- **Stop before step 7** (the overlay, teaser and afterglow UI) until Jordan approves the design.

These parts are accepted as written:
- the layout
- the two foreground services
- the event and effect tables
- the effect order on a natural end
- the kv keys
- the queue tests
- the logging rules
- the test plan
- the order of work

## Decisions on your flags

**G4: the M6 layer gate.**
- No shared flag. The gate lives in `m6World.ts`:
  - empty `musicCues`
  - empty ambience zones, profiles and landcover
  - `hushOn: false` and `beaconsEnabled: false`
  - all of it in one documented `M6_LAYERS` constant that M7 switches on
- **What this means:** the per-tier resolves belong to the music cue (`pickResolve` reads the current cue). So in M6 only a fragment's own resolve plays; otherwise there's the plain afterglow pause. Per-tier resolves arrive with the music in M7. That's accepted.
- The threshold motif and the locked teaser come from the grove's own data, so they still play.
- **Test:** a pack that carries music, ambience and beacon data produces no commands on the music or surroundings buses, no beacon and no Hush.

**G1: accuracy tolerance.** Default to 25 m. Record what the Pixel walk shows.

**G3: chime and haptic.**
- **Haptic: yes.** Use `expo-haptics`, a light impact, at every narration start from a trigger.
- **Chime:** stays a no-op until there's an asset (A6 decision G7). M7 adds the asset and its toggle.

**G5: preview.**
- Preview uses the device parser too.
- Lane A is adding `PreviewManifestDevice` in A7b (see below).

**G6: `LINK_DOMAIN` hosting.**
- Hosting waits for M12, because `assetlinks.json` needs the Play signing certificate, never the debug one.
- Add the intent filter now.
- M6 acceptance uses `intell://f/{code}`.

**G7: memory.** Record PSS (the app with the map and a real pack) on the emulator run and on the walk. There's no pass/fail line yet.

## Heads-up: the device parsers were shallow
`GrovePackDevice` and `RegionPackDevice` strip unknown keys only at the top level; nested objects are still strict. I missed this in the A5 review.
- Lane A is fixing it in a small separate PR, **A7b**, keeping the same names and adding `PreviewManifestDevice`.
- Switch your imports now.
- When A7b merges, merge master into your branch, then switch the preview path.

## Required changes
**R1: no coordinates on disk.** `kv` lives in the SQLite database, which goes into the phone's cloud backup.
- Before writing `session.state.v1`, set `recentFixes` to `[]`.
- Before writing `director.state.v1`, replace the location point with the neutral default.
- After a resume, nothing location-based happens until a fresh fix arrives (A4 needs two consecutive fixes anyway).
- **Test:** the stored JSON contains no lat/lng.

**R2: start the location service only in the foreground.**
- Android 14+ refuses to start a location-type foreground service from the background. expo-location's foreground-service path should refuse too. **Confirm that in expo-location 58's Android source before building.** If it requires `ACCESS_BACKGROUND_LOCATION`, stop and tell me.
- If the process restarts in the background while the session is `exploring`, don't start location; wait until the app is active.
- The session's tick rules (15 min outside, 3 h) still end the session.
- **A known limit, from the spec:** a session can only start while the app is on screen. Note it in the report.

**R3: two notifications.**
- The location service's notification uses TECH_SPEC §3.3's text, "InTell is playing your Grove", with a **Stop** action that sends `stop`. Make it low importance, with no sound.
- The media notification keeps the playback controls.
- On the walk, note whether having two notifications is confusing.

**R4: analytics.**
- A no-op in M6: count the events, but don't store them.
- A7 is changing the `analytics` effect to `{ name, props, refs }` and building the shared queue. You'll wire that in later.

**R5: the back button.** Use the shared `BACK_SKIP_MS`, not a local constant.

**R6: remote resume.** Measure it first, then tighten it if needed. Accepted as planned.

## Next
1. Commit this review.
2. Build steps 1–6 and step 8. Push regularly.
3. **Stop before step 7** and report:
   - what's built
   - the tests and CI
   - the expo-location finding (R2)
   - any new gaps
