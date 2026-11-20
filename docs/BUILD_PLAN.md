# InTell — Build Plan for Cursor (v2)

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
**Build:** every migration in DATA_MODEL §1–10; the playability functions; `fn_publish` and its checklist; RLS and buckets; pg_cron jobs; the `build-pack`, `publish`, `unpublish` and `purge-assets` edge functions; `get_pack_index`; seed data with the demo Grove; generated types; zod `GrovePack` and `RegionPack`.
**Accept when:**
- RLS tests pass (TECH_SPEC §10)
- The demo grove pack validates against zod and contains no forbidden fields (DATA_MODEL §12.4)
- Revoking the demo consent rebuilds the pack without that revision and the asset 404s
- Deciding the demo crossroads makes the dependent revision playable

## M3 — Admin: story authoring
**Build:** auth with roles and MFA for editor and admin; sites and approvals; the Grove editor (polygon, fragment tree, story order, gap hints, validation badges); rings; the story bible; the asset library (upload with sha, loudness and waveform; rights); the revision editor (per-language narration and transcript, credits, scheduling); the publish checklist UI; the audit log; contributors and consents.
**Accept when:** a Playwright test builds the demo grove from scratch and publishes it; a writer can't publish; the loudness warning shows for an off-target file.

## M4 — Admin: sound design and the Listening Simulator
**Build:** ambience profiles, layers and zones with audition; the landcover tool (`tools/landcover`) and grid upload with an H3 overlay; music zones, cues (condition builder), stems (loop-point editor, state-gain rules); the Web Audio `AudioEngine`; the Simulator (AUDIO_SPEC §8) using the shared `ambience.ts`, `music.ts`, `hush.ts`, `trigger.ts` and `unlock.ts`, which are **built and unit-tested in this milestone**.
**Accept when:** dragging the walker across zone edges blends profiles; toggling "heard" on a branch switches the music stem; speaker mode silences wildlife layers; a GPX replay at 4× works; the shared audio tests (AUDIO_SPEC §9) pass.

## M5 — Mobile: shell, map and offline packs
**Build:** tokens, fonts and components; i18n; splash → animation → welcome → location explainer; **the map home** (style, Groves, markers via `unlock.ts`, puck, Marker and Grove sheets, bottom bar with stub sub-screens); the pack index, download (manifest, tiles, assets), sync with mandatory deletion; `register-device`. **Decide the tile provider first.**
**Accept when:** in airplane mode a downloaded demo Grove renders its map, polygon and Root; a unit test proves revoked assets are deleted on sync; 300 markers pan smoothly on a mid-range Android.

## M6 — Mobile: narration, session, proximity and QR
**Build:** the session state machine; the location service (background during sessions, foreground service on Android); trigger and unlock with reveals (animation, toast, haptic); the playing overlay and afterglow; lock-screen controls; new-revision replay; unmarked fragments; QR universal links → protected fragments; accessible play; the visit record.
**Accept when:** with the demo GPX on the iOS simulator and an Android emulator, each revealed fragment triggers exactly once in tier order and unrevealed ones never trigger; a new revision replays once; denying location leaves tap-play and QR working; location stops within 5 s of the session ending.

## M7 — Mobile: surroundings, soundtrack and Hush
**Build:** the AudioDirector that binds the shared logic to the engine; ambience from zones and landcover with time, month and route filters; music cue selection, stems, crossfades and edge fades; ducking; Hush and afterglow; the Settings Audio page (mixer, Hush toggle, chime toggle); credits for music, surroundings and community sounds.
**Accept when:** on a real device walk of the demo GPX, the profile changes at the zone edge, music switches when a branch plays, Hush occurs after the interval and is cancelled by an arrival, and speaker mode drops wildlife layers; battery is under 12% for 60 minutes with all layers.

## M8 — Journal
**Build:** everything in JOURNAL_SPEC: Grove cards with tree thumbnails and status lines; Tree view (`treeLayout.ts`), Story view (`storybook.ts`, gaps, cast, canon), Visits view; Moment (Echo vs on-site replay, transcript, credits, version history, seeds here); field notes (text and voice) with share-as-seed; character cards; encrypted export and import.
**Accept when:** after the GPX walk, the tree shows heard, revealed and silhouette nodes correctly; the storybook shows the correct gaps with hints and never leaks protected locations; Echo plays narration only off site and the full mix inside the Grove; a revoked revision shows the unavailable state; export → reinstall → import restores the Journal.

## M9 — Grow: seeds, lineage, questions, Ledger, canon
**Build:** the Grow screen (PARTICIPATION_SPEC §5); the age gate; seed terms; hold-to-plant on the map and overlay; kind chips; text planting within 7 days; voice upload via a signed URL; the `plant-seed`, `seed-addendum` and `my-seeds` endpoints; lineage statuses; the "Your seed grew" moment (growth motif plus narrator cue) and the private sprout and tree map marks; questions gated by heard; Ledger and canon views; the check-in card. **Admin:** the seed inbox, ring board (create `seed_links`), questions editor, ledger review, Listening Day release, sound-seed promotion to an ambience asset.
**Accept when:**
- An E2E plants a voice seed offline → it syncs → an admin links it to a revision and publishes → the app shows Grown → walking to the fragment plays the growth moment exactly once
- An under-13 device can't plant
- PII is stripped
- A promoted sound seed plays in the ambience and the contributor sees "Your sound is part of…"

## M10 — Crossroads and attestation
**Build:** `attest`; the `vote` and `my-votes` endpoints; fork markers and the Fork sheet with place-gating (heard anchor, within radius, open); hidden tallies; the admin Crossroads builder with close → confirm → decided; dependent revisions and music cues unlocking; canon blocks.
**Accept when:** a vote is refused off site, before hearing the anchor, or without attestation; a vote can be changed until close; after deciding, the dependent revision plays and the music `outcome` cue activates in the Simulator and on device.

## M11 — Analytics and dashboard
**Build:** the event queue and `ingest-events`; every event in TECH_SPEC §8; dashboard views and pages (TECH_SPEC §9) with CSV; `delete-device-data`.
**Accept when:** dashboard numbers match a fixture dataset, including the ownership-return comparison; delete removes every server row and voice file for the device.

## M12 — Hardening, accessibility and field test
**Build:** Sentry scrubbing; the accessibility checklist (DESIGN §6); privacy policy and seed terms (from counsel); store assets; the final brand animation; Spanish strings if approved; a field-test script per Grove.
**Accept when:** field tests at the demo site and one real Grove pass on iOS and Android (phone in pocket: triggers, reveals, music, Hush, a seed planted by voice); TestFlight and Play internal builds are distributed.

---

## Definition of done (every PR)
- Strict types; pure logic in `packages/shared` with tests
- No location, free text or audio in telemetry; no new data-collecting SDKs
- Strings in i18n; accessibility labels; reduced motion respected
- Docs updated when behavior changes
