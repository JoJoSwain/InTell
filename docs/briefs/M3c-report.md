# M3c authoring — implementation report

**Branch:** `m3c-authoring` (PR #9 → `master`)  
**Plan:** `docs/briefs/M3c-plan.md` · **Plan review (wins):** `docs/briefs/M3c-plan-review.md`  
**Status:** Implementation complete locally; **stopped for architect review**. M3d not started.  
**Date:** 2026-11-20  
**Head SHA (at report write):** see latest commit on `m3c-authoring` after this file lands.

---

## 1. `git log --oneline` (vs `origin/master`)

```
(docs) M3c-report + e2e/geo/screenshot fixes   ← this / follow-up commits
6272160 fix(db): close gatherings RLS hole; fix M3c pgTAP fixtures
b9f1039 fix(db): use asset_kind in M3c loudness helpers
e197dcf feat(admin): M3c Story and Media authoring UI
437321f feat(shared): add BS.1770-4 loudness and m4a container parser
c425ef5 docs: add M3c plan review
72e5e5d docs: add M3c authoring plan
```

Note: stray loudness-only PR #10 (from a subagent branch) was **closed**; all M3c work is on PR #9 / `m3c-authoring`.

---

## 2. Command results

| Command | Result |
|---|---|
| `pnpm db:setup-local` / `supabase db reset` | **PASS** — migrations through `20261121140004_m3c_unreleased_draft_check.sql` + seed (`DEM00001`) |
| `pnpm exec supabase test db` | **PASS** — Files=**27**, Tests=**143** |
| `pnpm test:integration` | **PASS** — **16** tests |
| Playwright (`apps/admin`) | **PASS** — **9** tests |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** (shared 77; admin vitest 5) |
| `pnpm --filter @intell/admin build` | **PASS** |

CI / Vercel: pushed with this report; confirm green on PR #9 before merge.

---

## 3. Migrations (order)

| File | Purpose |
|---|---|
| `20261121140001_m3c_rls_fixes.sql` | **B1** split `fragment_threads` / `fragment_characters` / `journal_terms` / `landcover_*` (+ `gatherings` found by guard) into select + insert/update/delete; **answer 1** writer+ `audio_assets` write |
| `20261121140002_m3c_marker_loudness_cols.sql` | **B4** Crockford check on `marker_code`; migrate `DEMO-001` → `DEM00001`; **answer 3** `max_short_term_lufs` |
| `20261121140003_m3c_geo_setters.sql` | **Answer 2** `fn_set_grove_boundary` / `fn_set_fragment_location` (`security invoker`) |
| `20261121140004_m3c_unreleased_draft_check.sql` | Shared checklist helpers; rewrite `fn_publish_check`; **B5** `fn_draft_check`; **B3** `fn_unreleased`; oneshot LOUDNESS via `max_short_term_lufs`; **AUDIO_FORMAT** warnings |

---

## 4. Review items (B1–B6 + §11)

| Item | Done |
|---|---|
| B1 RLS delete hole + for-all guard pgTAP | Yes (`065_m3c_rls_delete_hole.test.sql`); also fixed `gatherings` |
| B2 OfflineAudioContext 48 kHz + container parser | Yes (`loudness.ts`, `container.ts`, fixture `minimal-mp4a.m4a`) |
| B3 `fn_unreleased` | Yes; Story Notes–only edit does not unrelease (`067`) |
| B4 Crockford + TECH_SPEC §5 M5 upper-case note | Yes |
| B5 `fn_draft_check` shares helpers with publish | Yes (`067` parity on local codes) |
| B6 physical → no radius UI; code kept when switching back | Yes (fragment form) |
| A1 writer audio upload | Yes + `066` |
| A2 invoker geo setters | Yes |
| A3 oneshot max short-term | Yes (column + helpers + publish/draft) |
| A7 hand-rolled SVG graph | Yes (`prereq-graph.tsx`) |
| A9–10 writer character fields / fragment_characters | Yes (status still F1-blocked) |
| A13 image size note, no transform | Yes |
| A14 no silent dedupe | Yes |
| A15 growth_cue omitted | Yes |
| A16 map only when key **and** Map ID | Yes |
| A17 print layout, staff view, editor rotate | Yes |
| A20 no Releases nav stub | Yes |

---

## 5. pgTAP count + new tests

- **Suite:** 27 files / **143** tests (was 24 / 130 on M3b tip).
- **New:** `065_m3c_rls_delete_hole`, `066_m3c_audio_writer`, `067_m3c_unreleased_draft_check`.
- **B1 guard:** fails if any `for all` policy has `USING` distinct from `WITH CHECK`.
- **110 allowlist:** adds `fn_draft_check(p_grove_id uuid)`, `fn_unreleased(p_grove_id uuid)`.

---

## 6. EBU 3341 / container fixture

**Loudness cases** (`packages/shared/src/audio/loudness.test.ts`):

- `EBU3341_stereo_1kHz_-23dBFS_integrated`
- `EBU3341_stereo_1kHz_-33dBFS_integrated`
- `EBU3341_short_term_max_on_tone_burst`
- `EBU3341_short_term_equals_integrated_when_under_3s`
- `EBU3341_true_peak_full_scale_sine`
- `EBU3341_true_peak_minus_6dBFS_sine`
- `EBU3341_mono_channel_weight_1_0`

**Container:** `packages/shared/src/audio/fixtures/minimal-mp4a.m4a` + `container.test.ts` (channels + sample rate from `stsd`/`mp4a`).

---

## 7. Playwright

| Spec | Coverage |
|---|---|
| `e2e/m3c-grove-authoring.spec.ts` | Editor: GeoJSON grove, 3 fragments, OR prereq + seed bridge, physical + print (no code in query) |
| `e2e/m3c-writer-refusal.spec.ts` | Writer Story Notes OK; grove create / lat / marker rotate refused |
| `e2e/m3c-offspec-upload.spec.ts` | Off-spec WAV → `AUDIO_FORMAT` + `LOUDNESS` on detail (or via dedupe link) |
| Prior M3b specs | Still green (auth-email ×4, staff-gate ×2) |

---

## 8. Terra Draw adapter requirements (answer 16)

From `apps/admin/src/components/maps/grove-boundary-map.tsx`:

- Constructor needs `{ lib: google.maps, map: google.maps.Map }`.
- Peer `@googlemaps/js-api-loader` comes via `@vis.gl/react-google-maps` (no direct dep).
- Map mounts only when **both** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAP_ID` are set; otherwise GeoJSON / lat-lng only.
- Pass the live `google.maps` namespace as `lib` after `APIProvider` loads.

---

## 9. Screenshots

| Shot | Path |
|---|---|
| Grove editor (fallback — no Maps key in this capture env) | `docs/briefs/m3c-screenshots/grove-editor-fallback.png` |
| Print marker page | `docs/briefs/m3c-screenshots/print-marker.png` |

Map-with-key screenshot: not taken here (Maps restricted to production admin + localhost with keys); fallback path is the CI/Playwright path.

---

## 10. Doc amendments (quoted)

**TECH_SPEC §5** (new lead-in for M5):

> **M5 note (physical markers):** when the phone opens `/f/{code}`, upper-case the scanned path segment before hashing (UTF-8 bytes of the upper-case Crockford base32 code) so it matches the pack `markerHash` produced from the stored upper-case `marker_code`.

Seed / fixture / pack tests: marker plaintext `DEMO-001` → `DEM00001`.

---

## 11. Deviations / notes

- Admin inserts geography via **EWKT placeholder + invoker RPC** (PostgREST GeoJSON objects returned `parse error - invalid geometry`).
- `gatherings` had the same B1 delete-hole pattern; fixed though not named in the review.
- README notes Chrome/Edge for loudness measurement.
- No secrets committed; marker codes not logged.

---

## 12. Open questions / blockers for architect

None blocking M3c acceptance. Optional follow-ups:

1. Whether seed demo tones should stay `.wav` (they correctly emit `AUDIO_FORMAT` warnings in the library list).
2. Hosted staging `db push` of the four M3c migrations (JoJo / ops) — local/CI is the M3c bar per review A18.

**Stop for architect review. Do not start M3d.**
