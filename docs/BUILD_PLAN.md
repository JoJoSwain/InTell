# InTell — Build Plan for Cursor (v3)

v3 reflects ADR 0004 (product realignment) and ADR 0002 (Google Maps, online). M2 shipped the v2 schema; M3 begins by realigning it.

Work through the milestones in order, one branch and one PR each. A milestone is done when its acceptance criteria pass and `pnpm lint && pnpm typecheck && pnpm test` is green.

Prompt Cursor with:
> "Read docs/PRODUCT_SPEC.md and the docs it lists, then Milestone N in docs/BUILD_PLAN.md. Implement Milestone N only. List any spec ambiguity before writing code."

---

## M0 — Scaffold
**Build:** pnpm + Turborepo; an Expo app (Router, TS strict, EAS profiles); a Next.js admin (Tailwind, shadcn/ui); `packages/shared` with the zod `L10n` schema and the events schema stub; `supabase init`; `tools/landcover/` stub; CI; `.env.example`; README; `docs/adr/`.
**Accept when:** the admin runs; a mobile dev build opens on both platforms; CI is green.

## M1 — Audio engine spike (highest technical risk; do it before anything else in audio)
**Build:** the `AudioEngine` interface (AUDIO_SPEC §2.2) and a `react-native-audio-api` implementation; a throwaway test screen that plays a narration file, a 3-stem looping music group, a bed with crossfade and random one-shots, with bus ducking, plus lock-screen metadata and route detection.
**Accept when:**
- A 60-minute screen-locked run on a real iPhone and a real Android shows no dropouts and keeps the stems sample-aligned
- Ducking ramps are smooth; switching between headphones and speaker is detected; a phone call interrupts and resumes
- Memory stays under 150 MB
- The results are written up in `docs/adr/0001-audio-engine.md`. **If any check fails, build the Expo Module fallback behind the same interface before moving on.**

## M2 — Database, rights, playability and packs
Delivered as M2a and M2b; see docs/briefs/M2-database.md.
**Build:** every migration in DATA_MODEL §1–10; the playability functions; `fn_publish` and its checklist; RLS and buckets; pg_cron jobs; the `build-pack`, `publish`, `unpublish` and `purge-assets` edge functions; `get_pack_index`; seed data with the demo Grove; generated types; zod `GrovePack` and `RegionPack`.
**Accept when:**
- RLS tests pass (TECH_SPEC §10)
- The demo grove pack validates against zod and contains no forbidden fields (DATA_MODEL §12.4)
- Revoking the demo consent rebuilds the pack without that revision and the asset 404s
- Deciding the demo crossroads makes the dependent revision playable

*(Done, merged as PRs #3 and #4. Consents, approvals, rings and crossroads were later removed by ADR 0004; M3a realigns the schema.)*

## M3 — Schema realignment, hosted admin and story authoring
Delivered as four PRs; see `docs/briefs/M3-admin.md`.
**Build:**
- **M3a, schema realignment:** new migrations bringing the database to DATA_MODEL v3 (groves absorb sites; contributors, consents, rights, approvals, rings and crossroads removed; physical markers; teasers; Indigeny notes; story-wide characters and threads; cross-grove prerequisites; Day/Night versions; Story Contingency and Correction; releases and published snapshots; Journal tables renamed); updated playability, checklist, pack builder (GrovePack schema 2), reconciler (images), jobs (scheduled releases, atomic go-live); rewritten tests and seed
- **M3b, hosted foundation:** a hosted Supabase staging project and a hosted admin; sign-in (email and password); `invite-staff`; the staff gate; the admin shell; regions; staff management; the audit log viewer; the Playwright harness and CI
- **M3c, authoring:** the audio and image library (sha, loudness, true peak, format checks, waveform); the Grove editor on Google Maps (Terra Draw polygons or GeoJSON, fragments by map or coordinates, radius in feet, teasers, physical markers with printable QR codes, the cross-grove prerequisite-group editor, validation badges); Story Notes; characters and card lines
- **M3d, revisions, releases and preview:** the revision editor (Day/Night versions, transcripts, Story Contingency or Correction); releases (checklist, publish now, schedule, history); unpublish with stranded-prerequisite warnings; the `preview` edge function
**Accept when:** a Playwright test builds a grove from scratch (with a physical marker, a Day-only fragment and a cross-grove prerequisite), publishes it in one release and the pack validates; a writer can't publish (UI and forced call); the loudness and format warnings show for an off-spec file; a scheduled release publishes on time and a broken one fails with its reason; a staged edit doesn't reach the pack until released.

## M4 — Admin: sound design and the Listening Simulator
**Build:** ambience profiles, Day/Night layers and zones with audition; the landcover tool (`tools/landcover`) and grid upload with an H3 overlay; music zones, Day/Night cues (condition builder), stems (loop-point editor, state-gain rules); the Web Audio `AudioEngine`; the Simulator (AUDIO_SPEC §8) using the shared `timeWindow.ts`, `ambience.ts`, `music.ts`, `hush.ts`, `trigger.ts` and `unlock.ts`, which are **built and unit-tested in this milestone**.
**Accept when:** dragging the walker across zone edges blends profiles; switching Day/Night swaps layers and cues; toggling "completed" on a branch switches the music stem; speaker mode silences wildlife layers; a GPX replay at 4× works; the shared audio tests (AUDIO_SPEC §9) pass.

## M5 — Mobile: shell, map and packs
**Build (after DESIGN's mobile sections are rewritten with Ashley):** tokens, fonts and components; i18n; splash → animation → welcome → location explainer; **the Google map home** (finish on top of `preview/m5-google-map-home`; iOS SDK and key; groves; 100%/35% markers via `unlock.ts` and `timeWindow.ts`; teaser pop-up; puck; Marker and Grove sheets; Chronicle, center and Journal buttons with stub screens; Settings top right); the pack index, download (manifest and assets), sync with mandatory deletion; `register-device`; staff sign-in and preview mode on the phone.
**Accept when:** a downloaded demo grove renders its markers at the right opacity by day and by night; a unit test proves assets missing from manifests are deleted on sync; 300 markers pan smoothly on a mid-range Android; a staff device sees a draft release in preview mode and a non-staff device never does.

## M6 — Mobile: narration, session, proximity and QR
**Build:** the session state machine; the location service (background during sessions, foreground service on Android); trigger and unlock with Day/Night version selection; Story Contingency resets and Corrections; cross-grove prerequisites; the playing overlay and afterglow; lock-screen controls; physical-marker QR universal links on `LINK_DOMAIN`; accessible play; completion records; the visit record.
**Accept when:** with the demo GPX on the iOS simulator and an Android emulator, each unlocked fragment triggers exactly once in tier order and locked ones never trigger; a contingency makes a completed fragment play again and gates new unlocks, while a correction doesn't; a Day-only fragment can't play at night; scanning a locked physical marker shows its teaser; denying location leaves tap-play and QR working; location stops within 5 s of the session ending.

## M7 — Mobile: surroundings, soundtrack and Hush
**Build:** the AudioDirector that binds the shared logic to the engine; ambience from zones and landcover with Day/Night, month and route filters; music cue selection (Day/Night), stems, crossfades and edge fades; ducking; Hush and afterglow; the Settings Audio page (mixer, Hush toggle, chime toggle).
**Accept when:** on a real device walk of the demo GPX, the profile changes at the zone edge, music switches when a branch plays and at sunset, Hush occurs after the interval and is cancelled by an arrival, and speaker mode drops wildlife layers; battery is under 12% for 60 minutes with all layers.

## M8 — Chronicle
**Build (after `CHRONICLE_SPEC.md` is written):** character cards (portrait, growing summary from card lines, groves, related fragments); completed fragments with replay per completed time version, narration only off site; related locked fragments with teasers; the visit history.
**Accept when:** after the GPX walk, only fragments completed on site are replayable, and only in the time versions completed; a contingency removes the superseded version from replay until the new one is completed on site; character cards show only what the listener has met; nothing locked shows more than its teaser.

## M9 — Journal
**Build (after the Journal spec is written):** the Journal screen; the age gate; Journal terms; text and voice entries (voice via a signed URL); the `journal-entry` and `my-entries` endpoints; lineage statuses and the "your idea grew" moment; questions gated by completion; the check-in card. **Admin:** the Journal inbox (read, tag, link to revisions) and the questions editor.
**Accept when:** an E2E submits a voice entry → it syncs → an editor links it to a revision and publishes a release → the app shows Grown → walking to the fragment plays the growth moment exactly once; an under-13 device can't submit; PII is stripped.

## M10 — *(removed)*
Crossroads and attestation were removed by ADR 0004. The number is kept so later milestones keep their names.

## M11 — Analytics and dashboard
**Build:** the event queue and `ingest-events`; every event in TECH_SPEC §8; dashboard views and pages (TECH_SPEC §9) with CSV; `delete-device-data`; `export-archive`.
**Accept when:** dashboard numbers match a fixture dataset, including the contribution-return comparison; delete removes every server row and voice file for the device.

## M12 — Hardening, accessibility and field test
**Build:** Sentry scrubbing; the accessibility checklist (DESIGN §6); privacy policy and Journal terms (from counsel); store assets; the final brand animation; a field-test script per Grove (day and night).
**Accept when:** field tests at the demo site and one real Grove pass on iOS and Android, by day and by night (phone in pocket: triggers, unlocks, a physical-marker scan, music, Hush, a voice Journal entry); TestFlight and Play internal builds are distributed.

---

## Definition of done (every PR)
- Strict types; pure logic in `packages/shared` with tests
- No location, free text or audio in telemetry; no new data-collecting SDKs
- Strings in i18n; accessibility labels and alt text; reduced motion respected; distances in feet and miles
- Docs updated when behavior changes
