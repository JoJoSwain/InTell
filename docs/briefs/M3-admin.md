# Brief: M3, schema realignment, hosted admin and story authoring

**Milestone:** M3 (BUILD_PLAN v3), delivered as **four PRs**, in order:
- **M3a:** schema realignment (database, functions, packs, tests and seed brought to DATA_MODEL v3)
- **M3b:** hosted foundation (hosted staging, sign-in, invites, staff gate, admin shell, regions, staff, audit log, Playwright and CI)
- **M3c:** authoring (audio and image library, Grove editor on Google Maps, physical markers and QR printing, prerequisites across groves, Story Notes, characters)
- **M3d:** revisions, releases and preview (revision editor, releases with checklist and scheduling, unpublish, the `preview` function)

**Branches:** `m3a-schema-realign`, `m3b-hosted-foundation`, `m3c-authoring`, `m3d-releases`. Each is cut from `origin/master` after the previous PR merges.
**Author:** architect (Claude), 2026-11-20
**Read first, in this order:**
1. `docs/adr/0004-product-realignment.md` (all of it; it beats any older text)
2. `AGENTS.md`
3. `docs/DATA_MODEL.md` (v3, all of it)
4. `docs/PRODUCT_SPEC.md` (v3)
5. `docs/TECH_SPEC.md` §1, §4–7 and §10
6. `docs/AUDIO_SPEC.md` §3.2, §4 and §6
7. `docs/adr/0002-map-provider.md`, `docs/adr/0003-story-graph.md`
8. `docs/BUILD_PLAN.md` M3
9. `docs/briefs/M2-followups.md`

This replaces the draft M3 brief written earlier on 2026-11-20, which was never committed.

## Goal
Bring the merged M2 backend in line with the realigned product, then give Replaceplace's 5–10 staff a hosted admin where they can build a grove from nothing (on Google Maps, with physical markers, Day/Night versions and prerequisites across groves) and publish it in one release. The database stays the security boundary: every rule that matters is enforced by RLS or a guarded function, never only by hidden UI.

## Status (context)
- M2 is merged (PRs #3 and #4). The publish → pack → reconciler → jobs pipeline works and is well tested. **M3a adapts it; it doesn't rebuild it.**
- **ADR 0001 (audio) is still Proposed.** Don't touch `apps/mobile/src/audio/` or `packages/shared/src/audio/AudioEngine.ts`. The new `loudness.ts` is a pure analysis module and is allowed.
- **ADR 0002 is Accepted (Google Maps, online).** **ADR 0004 is Accepted.**
- Deferred until after M3 (don't do them here): the CI `RUN_JOBS_URL` confirmation and the cron → pg_net → `run-jobs` end-to-end test, the duplicate script keys in the root `package.json`, and M2 follow-up #4 (R1 default privileges).

## Preconditions (check these first; stop and report if any fails)
1. Docker Desktop is running; on `origin/master`, `pnpm db:setup-local`, `pnpm exec supabase test db` and `pnpm test:integration` (with `supabase functions serve`) are green.
2. `git status` is clean, and `origin/master` contains the M2b merge `134c413` and the docs commit for ADR 0004.
3. **Before M3b only** (stop and ask JoJo if missing): a hosted Supabase **staging** project, a Vercel project (or JoJo's chosen host) for the admin, Google Maps API keys (admin web key; map ID), and an SMTP provider for invite emails. JoJo creates these. **No keys go in the repo**; Cursor only adds empty entries to `.env.example` files.

## Decisions already made (don't revisit)
1. **New migrations only.** Never edit a merged migration. The local and CI databases hold only seed data, and no hosted project has data yet, so M3a migrations may drop tables and columns outright. Generate types after each migration.
2. **Keep the M2 pipeline shape:** two-phase publish (check → copy → commit), the jobs outbox, `build-pack` with canonical JSON and no-op rebuilds, the reconciler, superseded-manifest deletion, cache headers, the definer-grant allowlist test, option C shared code with the drift check.
3. **Releases and snapshots** exactly as DATA_MODEL §8 and §10: packs read `published_snapshots` and current revisions, never working rows. This applies to every publishable entity (groves, fragments, characters, images, ambience profiles and zones, music zones and cues, UI cues), so the pipeline is uniform before M4 builds the sound UI.
4. **Atomic go-live:** builds tagged with a release are `live = false` until every build for that release succeeds, then all flip in one transaction; `get_pack_index` exposes only live builds.
5. **Scheduled releases:** `publish_release` jobs from pg_cron; the job calls `publish` as the service role; failure → `failed` + `last_check`.
6. **Story-wide prerequisites:** remove the same-grove guard; the cycle check runs story-wide under one advisory lock (this supersedes M2 follow-up #2).
7. **Contingency math** per DATA_MODEL §4, implemented in SQL (for packs) and as a pure function in `packages/shared/src/story/contingency.ts` (for devices), with matching tests.
8. **Day/Night** per AUDIO_SPEC §3.2: `packages/shared/src/time/timeWindow.ts` (pure, `suncalc`, region sun reference, polar fallback) with tests.
9. **Auth:** `@supabase/ssr` cookie sessions; email and password; **no two-factor**; no self-signup (disable it in `supabase/config.toml` and on the hosted project); password protections on (minimum length 10, leaked-password protection where the plan supports it, session expiry). A signed-in user without an active `staff` row sees only a "no access" page.
10. **The admin never uses the service role key**, browser or server. Invites go through the `invite-staff` edge function (admin role only, verified as the caller under RLS), which sends the Supabase invite email and creates the `staff` row.
11. **Admin map:** the Google Maps JavaScript API via `@vis.gl/react-google-maps`, with `terra-draw` and its Google Maps adapter for polygons. **Every geometry can also be entered without the map:** paste or upload GeoJSON for a grove polygon, type lat/lng for a fragment. When no Google key is configured (CI, Playwright), the map is replaced by those inputs and nothing breaks. Distances are shown in feet (a shared `units.ts` with tests); storage stays metric.
12. **Physical markers:** the admin generates a random code (8 characters, an unambiguous base32 alphabet), stores it in `fragments.marker_code`, and renders a printable page at `/print/marker/[fragmentId]` with a QR code for `https://{LINK_DOMAIN}/f/{code}` (via `qrcode`). Replacing a lost marker generates a new code (staged until released). The code is never logged and never leaves Postgres except on that print page for editors.
13. **Loudness:** `packages/shared/src/audio/loudness.ts`, pure ITU-R BS.1770-4 integrated loudness and true peak on Float32 PCM, tested against EBU Tech 3341 reference signals generated in the test (±0.1 LU). The admin also reads format, channels, sample rate and bitrate, and shows `LOUDNESS` and `AUDIO_FORMAT` warnings at upload and in the checklist.
14. **Fold in M2 follow-up #1 (definer allowlist) in M3a:** revoke from `authenticated` every definer function the admin doesn't call directly; where it does (e.g. `fn_publish_check` for the checklist UI), add a staff `has_role` guard. Shrink `110_definer_grants.test.sql` to match, with a comment on every line saying why it's allowed.
15. **Tests:** pgTAP for every migration; the Vitest integration suite rewritten for v3; Vitest for pure admin logic; **Playwright** (`apps/admin/e2e`) against the local stack plus `functions serve`, added to the CI `db` job. Test users (admin, editor, writer) are created by a script, never committed as secrets.
16. **Dependencies allowed without asking** (all in TECH_SPEC §1): `@supabase/ssr`, `@supabase/supabase-js`, `@vis.gl/react-google-maps`, `terra-draw` and its Google Maps adapter, `qrcode`, `suncalc`, `wavesurfer.js`, shadcn/ui components, `@playwright/test`, `vitest`. Anything else goes in the plan for approval.

## Out of scope
- Sound-design UI: ambience, music, zones, landcover and the Listening Simulator (M4). M3a still migrates their **schema** (Day/Night columns, snapshots) so nothing needs reworking later.
- The Journal inbox and questions UI (M9). M3a renames the tables only.
- Any mobile change (M5+), including the phone side of preview mode.
- The dashboard (M11). Production deploys (staging only in M3).

## Hard constraints most at risk here
- **Marker codes** never reach a pack, a log, Sentry, a URL other than the printed QR, or any role other than editor and admin.
- **Staged edits** must not reach phones: test that editing a published fragment changes nothing in its pack until a release containing it is published.
- **Story Notes** (thread titles and notes, character notes, Indigeny notes) never reach a pack or a non-staff role.
- **No AI generation** anywhere in authoring: no suggested teasers or transcripts, no TTS, no auto-titles.
- **Hiding UI is not security.** Every role limit has a database test, and the important ones also have a Playwright test that forces the action and checks the refusal.

---

## M3a: schema realignment (PR 1)
1. **Migrations** (grouped by area; propose the exact files in the plan) to reach DATA_MODEL v3:
   - enums (v3 values; drop removed types once nothing uses them)
   - regions (`sun_reference`), groves absorb sites (`region_id`, access notes, links, wildlife setting, growth cue); drop `sites`, `site_approvals`
   - drop `contributors`, `consents`, `asset_rights`, `revision_contributors`, `rings`, `crossroads*`; drop ring, outcome, consent and credit columns
   - `audio_assets` (`bitrate_kbps`, `true_peak_dbtp`, drop `source`), new `image_assets` and the `staging-images` bucket; drop `private-docs`; rename `seeds-voice` → `journal-voice`
   - story: story-wide `threads` and `characters` (+ `public_intro`, `portrait_image_id`, `status`), `fragments` (`teaser`, `visibility` standard/physical, radius in metres 4.57–10.67 default 10.67, Indigeny notes, drop `gap_hint` and ring links), `fragment_characters` (`prominence`, `card_line`), revisions (`change_kind`, `release_id`, drop `publish_at`/ring/outcome), `revision_versions` (`time_window`, unique per language and window)
   - ambience layers and music cues get a required `time_window`
   - Journal tables renamed and trimmed (DATA_MODEL §7)
   - `releases`, `release_items`, `published_snapshots`; `pack_builds.release_id` and `live`; `jobs.kind` adds `publish_release`
2. **Functions:** v3 playability (§9); `fn_contingency_revision_no`; `fn_publish_check(release_id)` / `fn_publish_commit(release_id)` with the v3 checklist codes (§11); `fn_unpublish_commit` with the stranded-prerequisite warning; story-wide `fn_prereq_guard`; `get_pack_index` (live builds only); RLS per §13 (writer, editor and admin limits; audit log readable by editor and admin); follow-up #1.
3. **Edge functions:** `publish` and `unpublish` take a release; `build-pack` builds **GrovePack schema 2** and the v3 region pack from snapshots; `purge-assets` reconciles audio **and** images; `run-jobs` handles `publish_release` first, then rebuilds, then reconciles; atomic go-live.
4. **Shared code:** zod `GrovePack`/`RegionPack` v3 in `packages/shared/src/schemas/packs.ts` (forbidden-fields tests updated: no marker codes, no Story Notes); `music.ts` conditions without `ringIds`, `outcome` and `timeWindows`; `contingency.ts`; `timeWindow.ts`; `units.ts`. Re-sync the edge copies (`pnpm db:sync-edge-shared`).
5. **Seed and fixtures** per DATA_MODEL §15 (Frag 9 physical; a contingency on Frag 10 and a correction on Frag 4; Day-only and Day+Night fragments; a second small test grove with a cross-grove prerequisite; story-wide characters with placeholder portraits; one published and one draft release). Regenerate seed media and `seed-media.json`. Update the demo GPX if the fixture changes.
6. **Tests:** rewrite or delete every pgTAP and integration test that covers removed concepts (consent revocation, approvals, rings, crossroads, protected coordinates); add tests for each v3 checklist code, contingency math, cross-grove prerequisites and cycles, staged edits not leaking, atomic go-live across two groves, scheduled release success and failure, the image reconciler, and the definer allowlist.

**M3a acceptance:**
- [ ] `supabase db reset` applies every migration and the seed cleanly
- [ ] `supabase test db`, `pnpm test:integration` and root checks are green, locally and in CI
- [ ] The demo grove pack validates against GrovePack schema 2 and contains no marker codes or Story Notes
- [ ] Editing a published fragment changes nothing in its pack until a release containing it is published
- [ ] A release spanning both test groves goes live atomically
- [ ] A contingency revision bumps `contingencyRevisionNo`; a correction doesn't
- [ ] DATA_MODEL v3 matches what shipped; any deviation is reported and quoted

## M3b: hosted foundation (PR 2)
1. Auth (sign in, sign out, password reset, session refresh), the staff gate, `invite-staff` (invite, deactivate), password policy (decision 9)
2. The admin shell: the DESIGN §5 sidebar, a role-aware layout, tokens mirrored in Tailwind, status badges
3. **Regions** (name, timezone, sun reference, bounds), **staff management** (admin only), and the read-only **audit log** viewer with filters (editor and admin)
4. **Hosting:** wire the admin to the hosted staging Supabase project and the hosting provider through environment variables; document the deploy in `README.md`; migrations and edge functions deployed to staging by a documented command (no keys committed)
5. The Playwright harness, the test-user script, CI wiring, and a smoke E2E: an admin invites a writer → the writer signs in → the writer can't reach staff management or publish

**M3b acceptance:**
- [ ] Staff can sign in to the hosted staging admin from their own computers
- [ ] A user without a staff row sees only "no access"; a writer is refused by the database for editor actions (pgTAP + Playwright)
- [ ] Self-signup is disabled, and invites work end to end
- [ ] Every CI job is green

## M3c: authoring (PR 3)
1. **Audio library:** upload (sha, duration, channels, sample rate, bitrate, loudness, true peak in the browser), waveform, tags, search by kind, `LOUDNESS` and `AUDIO_FORMAT` warnings, duplicate sha reuse
2. **Image library:** upload with dimensions and required alt text
3. **Grove editor:** the Google map with Terra Draw (or GeoJSON); region; name, premise, access notes, links, wildlife setting; fragments by map click or lat/lng; tier, visibility (standard or physical), radius in feet (15–35, default 35), teaser, story order, is_ending; the prerequisite-group editor ("needs one of …" rows) with fragments from **any** grove; a graph view; validation badges from the checklist; an "Unreleased changes" marker on edited live content
4. **Physical markers:** code generation, the print page, code replacement (decision 12)
5. **Story Notes:** threads; private character notes; the Indigeny note (Earth / World / Body) on each fragment
6. **Characters:** public name, public intro, portrait, and per-fragment links (prominence, introduces, card line)

**M3c acceptance:**
- [ ] A Playwright test builds a grove from GeoJSON with three fragments, an OR group, one physical marker and a prerequisite in the other test grove
- [ ] Uploading an off-spec file shows the loudness and format warnings
- [ ] `loudness.ts` passes the EBU 3341 tests; `units.ts` and `timeWindow.ts` tests pass
- [ ] A writer can edit Story Notes and drafts but not groves or fragments (pgTAP + Playwright)
- [ ] Root checks are green

## M3d: revisions, releases and preview (PR 4)
1. **Revision editor:** Day and/or Night versions, each with narration (asset picker) and transcript; Story Contingency or Story Correction (required, no default; the first revision is a contingency); an internal change note. Writers create drafts; editors publish.
2. **Releases:** create, add items (revisions, groves, fragments, characters, images), run the checklist (failures grouped by code and entity, each linking to the field that fixes it; warnings don't block), publish now or schedule, see history, and see a failed scheduled release's reason
3. **Unpublish** with the stranded-prerequisite warning
4. **`preview` edge function** (DATA_MODEL §12.5): staff-only, a preview manifest for one draft release with expiring signed URLs; integration tests only (the phone side is M5)

**M3d acceptance** (BUILD_PLAN M3):
- [ ] A Playwright test builds a grove **from scratch** (new grove, not the seeded one): region → grove → assets → fragments (one physical, one Day-only, one with a cross-grove prerequisite) → revisions → release → checklist green → publish → the grove appears in `get_pack_index` and its pack validates
- [ ] A Story Contingency release changes `contingencyRevisionNo` in the pack; a Story Correction doesn't
- [ ] A writer can't publish (the button is absent **and** a forced call is refused)
- [ ] A scheduled release publishes on time; a broken one fails with its reason
- [ ] `preview` refuses non-staff and returns expiring URLs for staff
- [ ] Every CI job is green

## Plan checkpoint (before M3a)
Write `docs/briefs/M3a-plan.md` and **stop for architect review**. Include:
- the precondition results
- the migration file list in order, and for each table: create, alter (column by column), rename or drop
- how existing functions, triggers, cron jobs and grants change (every function: keep, rewrite or drop)
- how the snapshot model works in practice: what's written at commit, how `build-pack` reads it, and how staged edits are detected for the "Unreleased changes" marker
- how atomic go-live is implemented and tested
- the GrovePack schema 2 and RegionPack diffs against v2
- the test plan: which pgTAP and integration tests are deleted, rewritten or added (by file)
- the seed and fixture changes, including how the cross-grove test grove is generated
- **every ambiguity or contradiction you find** in DATA_MODEL v3 or ADR 0004. List them; don't resolve them silently.

Write a short plan before each later PR (`M3b-plan.md`, `M3c-plan.md`, `M3d-plan.md`) and stop each time. The M3b plan must cover the auth/session design, `invite-staff`, the hosting setup and env vars, and how Playwright runs without a Google key.

## Report back with (each PR)
1. `git log --oneline` for the branch, plus the output of `supabase db reset`, `supabase test db`, `pnpm test:integration`, Playwright (from M3b) and the root checks
2. Any doc amendments, quoted
3. Deviations from this brief, and why
4. Open questions
