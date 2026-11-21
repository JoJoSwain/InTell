# M3c authoring: architect review of the plan

**Plan reviewed:** `docs/briefs/M3c-plan.md` (`72e5e5d`, PR #9)
**Verdict:** **APPROVED with the additions and answers below.** Implement M3c on `m3c-authoring`. Where this review conflicts with the plan or the brief, this review wins.
**Reviewer:** architect (Claude), 2026-11-20

This is a thorough plan: clean preconditions, the right fallback-first approach to the map, and a sharp ambiguity list. Two of the additions fix real defects: an RLS hole the plan didn't spot (B1), and a Web Audio behaviour that would make the format check wrong (B2).

---

## Additions (required)

### B1. Close the RLS delete hole on five tables
Five policies are `for all` with a `using` clause that admits **every** staff role and a narrower `with check`. `with check` doesn't apply to DELETE, so a viewer, moderator or sound user can **delete** rows today. The five:

- `fragment_threads`, `fragment_characters` (M3c authors these)
- `journal_terms`, `landcover_classes`, `landcover_grids`

Replace each with a `select` policy for all staff, plus `insert` / `update` / `delete` policies with the narrower role set: writer+ for the two fragment link tables, and the existing `with check` roles for the other three. Add pgTAP proving a viewer's delete leaves the row in place, and a writer's (or editor's) delete works. Add a pgTAP guard that fails if any `for all` policy has a `using` role set wider than its `with check`, so the pattern can't come back.

### B2. Measure audio the way the browser actually decodes it
`decodeAudioData` **resamples to the context's sample rate**, so `AudioBuffer.sampleRate` is the machine's rate (often 48 kHz), not the file's.

- **Loudness:** decode into an `OfflineAudioContext` at **48 kHz**, so analysis is the same on every machine. Run `loudness.ts` with the BS.1770 48 kHz coefficients, and do true peak by 4× oversampling (192 kHz). Resampling doesn't meaningfully change loudness.
- **Native sample rate and channels for `AUDIO_FORMAT`:** read them from the container. Add a small pure parser in `packages/shared/src/audio/container.ts` for `.m4a` (the `stsd` → `mp4a` sample entry: channel count and sample rate), unit-tested against a tiny committed fixture. Any extension other than `m4a` is an `AUDIO_FORMAT` warning on its own, with no parsing needed. Channel count from the decoded buffer is fine as a cross-check.
- **Bitrate:** the average, `bytes × 8 ÷ duration`, with a **±15%** tolerance against the AUDIO_SPEC §6 value. No container-bitrate parsing.
- **If the browser can't decode the file:** upload anyway with loudness `null`, show "Couldn't measure loudness in this browser. Use Chrome or Edge.", and let the existing `LOUDNESS` (not measured) warning stand.

### B3. Compute "Unreleased changes" in Postgres, one call per page
Don't call `fn_snapshot_projection_guarded` once per row and compare JSON in TypeScript. Add a set-returning function, e.g. `fn_unreleased(p_grove_id uuid default null)`, returning `(entity text, entity_id uuid)` for every publishable entity whose projection `is distinct from` its `published_snapshots.data`. With a grove id, it returns only that grove and its fragments; without one, it covers everything, including story-wide characters and images. Write it as `security invoker` if RLS-visible reads suffice; otherwise as a guarded definer with a `110` allowlist line. Then:

- A list page makes one call.
- Never-published entities show **Draft**.
- A pgTAP test proves that a Story Notes–only edit doesn't mark an entity unreleased.

### B4. Marker code format, enforced by the database
- **Alphabet:** Crockford base32, upper case, `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no I, L, O, U). Eight characters.
- **Generation:** `crypto.getRandomValues`, taking `byte & 31` per character. 32 divides 256, so there's no bias.
- **Database:** add a check constraint, `marker_code is null or marker_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'`, in a new migration. Seed and fixture codes must conform.
- **Canonical form:** the stored upper-case code, hashed as its UTF-8 bytes (it's ASCII, so nothing needs normalizing). Record in TECH_SPEC §5, for M5, that the phone upper-cases the scanned path segment before hashing.

### B5. One source of truth for validation badges
The Grove editor needs checklist badges without a release. Add a draft check, e.g. `fn_draft_check(p_grove_id uuid)`, that returns the same issue shape and codes as `fn_publish_check`. Have both call the **same** per-entity rule code, so the rules can't drift. Refactor `fn_publish_check` onto the shared helpers. No client-side re-implementation of rules. Security: as in B3. pgTAP: a fixture grove yields the same codes from both functions.

### B6. Physical fragments have no radius
`triggerRadiusM` is `null` for physical fragments in the projection. The fragment form hides the radius control when visibility is **physical** and shows it (15–35 ft, default 35) for **standard**. Switching to physical generates a code if there isn't one. Switching back to standard keeps the code on the row but stops printing it.

---

## Answers to §11

| # | Decision |
|---|---|
| 1 | **DATA_MODEL §13 wins.** Writers upload audio. Replace `audio_assets_sound_write` with a writer + sound + editor + admin policy, mirroring `image_assets`. The storage policies already allow writers. pgTAP for writer insert and viewer refusal. |
| 2 | **In scope, as `security invoker` geometry setters, not definers:** `fn_set_grove_boundary(p_grove_id uuid, p_geojson text)` and `fn_set_fragment_location(p_fragment_id uuid, p_lat float8, p_lng float8)`. They run under the caller's RLS (editor+ on `groves` / `fragments`), so they need no role guard and no `110` change. They set geometry only; every other field goes through the normal RLS path. `fn_fragment_guard`'s `ST_Covers` still applies. Return a clear error when a point falls outside the boundary. |
| 3 | **sfx_oneshot uses the maximum short-term loudness** (3 s window, BS.1770 / EBU R128), compared with −24 ±2 LU. For clips under 3 s, use the integrated loudness of the whole clip. `loudness.ts` exposes `integrated`, `maxShortTerm` and `truePeak`. `loudness_lufs` always stores the **integrated** value. The upload warning and `fn_draft_check` use `maxShortTerm` for oneshots, which means storing it: add a nullable `audio_assets.max_short_term_lufs`. Every other kind uses integrated. |
| 4 | See B4: Crockford base32, upper case. |
| 5 | See B4: sha256 of the UTF-8 bytes of the stored upper-case code, with no other normalization. |
| 6 | **Confirmed:** the QR host is the listener link domain `intell.replaceplace.com` (`NEXT_PUBLIC_LINK_DOMAIN`), **not** the admin host. |
| 7 | **No new dependency.** A hand-rolled, read-only SVG: layer the nodes by longest prerequisite path, show OR groups as a small junction node, show cross-grove prerequisites as labelled stubs, and let a click open the fragment. Story graphs here are small. |
| 8 | See B5. |
| 9 | **Writers may edit every character field except `status`.** The M3a F1 guard already blocks `status`. The working row is staged, so nothing reaches phones until an editor releases it. That matches DATA_MODEL §13's "characters (draft)". |
| 10 | **Writers may attach characters to fragments** (prominence, introduces, card line), consistent with §13 and the current RLS, once B1 fixes the delete hole. These links are staged like any other edit. |
| 11 | **Fail soft** per B2. The README states that the admin supports current Chrome and Edge. Playwright stays Chromium-only. |
| 12 | See B2: average bitrate, ±15%. |
| 13 | **No server-side transforms**, and keep the existing `ext` check. Show a **non-blocking** upload note when the longest edge is over 2048 px or the file is over 1 MB, because images ship in packs. No new checklist code. Alt text is required in the form (`NO_ALT_TEXT` remains the publish error). |
| 14 | **Don't dedupe silently.** On a sha hit, show "This file is already in the library as '<title>'" with a link to it, and create no new row. Title and tags are edited on the existing row through its normal form. If a row exists but its staging object is missing, re-upload the object. Upload with `upsert: false`, and treat "already exists" as success. |
| 15 | **Deferred to M4** with the sound UI. The grove form omits `growth_cue_id` in M3c. |
| 16 | **Use the Map ID.** Both `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAP_ID` are set on the hosted admin. The map renders only when **both** are present; otherwise the GeoJSON and lat/lng inputs stand alone. Check Terra Draw's adapter requirements at implement time and report them. |
| 17 | **Minimal print layout** with no sidebar, still behind the staff gate, and viewable by any active staff role (the M3a amendment). Rotating the code is editor+ and enforced by RLS, with a Playwright test that forces it as a writer. The page shows the QR (at least 2 in / 5 cm printed), the code in text under it, the fragment's title, and the "works once released" notice when the working hash differs from the snapshot. Print CSS only; Ashley styles it later. |
| 18 | **Implementation waits only on this review**, not on the staging go-live. Local and CI green is the bar. |
| 19 | **Generate the signals in the test** (decision 13): the EBU Tech 3341 integrated-loudness cases that are synthesizable sine and tone-burst signals, short-term cases for `maxShortTerm`, and the synthesizable true-peak cases, all at ±0.1 LU / ±0.2 dB. Mono is one channel with weight 1.0, per BS.1770. Name the cases covered in the report. |
| 20 | **Confirmed:** no Releases item until M3d, and no disabled stubs. |

## Notes
- **No AI generation** anywhere in authoring (hard constraint): no suggested teasers, titles or transcripts.
- **Marker codes** stay out of URLs (the print path uses the fragment id), logs, Sentry and telemetry. Keep the pack forbidden-fields test green.
- **For the sound team in M4, not M3c:** AUDIO_SPEC sets mono narration at −16 LUFS, measured strictly per BS.1770. On phones, mono plays on both channels and sounds about 3 LU louder than a stereo file at the same reading. Measure per BS.1770 now and revisit the targets when the mix is tuned in M4.
- **Maps on previews:** as planned, maps don't load on Vercel preview hosts. Test map work locally.

## Report back with (in addition to the brief's list)
- Migrations in order, covering B1, B4 and the changes from answers 1, 2 and 3 (`max_short_term_lufs`)
- The pgTAP count, plus the new RLS guard test from B1
- The EBU 3341 cases covered, and the container-parser fixture
- Playwright: the M3c acceptance spec, the writer-refusal spec, and the off-spec upload spec
- Terra Draw adapter requirements found (answer 16)
- Screenshots of the Grove editor (map on localhost; fallback without a key) and the print page

**Then stop for architect review of the report.**
