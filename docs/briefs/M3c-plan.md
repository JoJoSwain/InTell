# M3c plan — authoring

**Branch:** `m3c-authoring` from `origin/master` @ `98d62f1` (merge PR #8 / M3b; contains `0f95c3a`)  
**Brief:** `docs/briefs/M3-admin.md` § M3c + decisions 11–13  
**Wins on conflicts:** ADR 0004 → ADR 0002 → DATA_MODEL / AUDIO_SPEC / TECH_SPEC → M3 brief → this plan  
**Stop after this plan** for architect review. **Do not implement** until approved.  
**No secret values** in this plan or in chat.

---

## 1. Precondition results

| Check | Result |
|---|---|
| `git checkout master && git pull` | **PASS** — tip `98d62f1` Merge pull request #8 |
| `0f95c3a` ancestor of `master` | **PASS** (`git merge-base --is-ancestor`) |
| Branch `m3c-authoring` cut from `origin/master` | **PASS** |
| `pnpm db:setup-local` | **PASS** |
| `pnpm exec supabase test db` | **PASS** — 24 files / 130 tests |
| `pnpm test:integration` | **PASS** — 16 tests |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** |

Working tree clean at plan write (plan file is the only intended change on this branch).

---

## 2. Routes, pages and components (`apps/admin`) — server action vs edge vs RLS

Nav (DESIGN §5): add **Story** (Groves, Characters, Story Notes) and **Media** (Audio, Images). Keep Ops. Omit Sound / Journal / Releases / Simulator until M4 / M9 / M3d.

| Area | Routes / UI | Server action | Edge function | Direct RLS / storage |
|---|---|---|---|---|
| **Audio library** | `/media/audio`, `/media/audio/[id]`; upload form; waveform (`wavesurfer.js`); kind filter; tags; search; `LOUDNESS` / `AUDIO_FORMAT` badges | Optional: wrap insert + duplicate-sha lookup for nicer errors. Prefer client → Storage + table insert under session | **None** | `staging-audio` policies; `audio_assets` insert/update (see §3 / §11 — writer vs sound mismatch) |
| **Image library** | `/media/images`, `/media/images/[id]`; upload; dimensions; required alt text | Same pattern as audio | **None** | `staging-images`; `image_assets` (writer+ already) |
| **Grove editor** | `/story/groves`, `/story/groves/new`, `/story/groves/[id]` (+ fragments panel / graph); map or GeoJSON / lat-lng fallbacks; prereq-group editor (any grove); checklist badges; Unreleased marker | Prefer **security-definer RPC** for boundary/location geography (same reason as M3b `fn_admin_upsert_region`) if PostgREST casting is painful; otherwise server actions calling RPC. Prereq / fragment field updates via server actions → Supabase user client | **None** (publish stays M3d) | `groves` / `fragments` / prereq tables: **editor+** write; writers read only. Writer Indigeny updates already via F1 allowlist |
| **Physical markers** | Controls on fragment form; `/print/marker/[fragmentId]` printable page | Generate code in server action (crypto), write `marker_code` via user session; rotate = new code on working row | **None** | Editor+ update on `fragments`; projection hashes code (never returns plaintext) |
| **Story Notes** | `/story/notes` (threads list/detail); Indigeny fields on fragment; character `notes` on character detail | Server actions → user client | **None** | `threads` writer+; fragment Indigeny via writer allowlist; character `notes` via `characters` writer+ |
| **Characters** | `/story/characters`, `/story/characters/[id]`; public name/intro; portrait picker; per-fragment links (prominence, introduces, card line) on grove fragment UI | Server actions → user client | **None** | `characters` writer+; `fragment_characters` / `fragment_threads` writer+ per current RLS |

**Shared client libs (not routes):** `lib/maps/*` (APIProvider / fallback), `lib/media/upload.ts` (sha256 + storage path), `lib/audio/analyze.ts` (decode → `loudness.ts`), `lib/markers/code.ts`, `components/unreleased-badge.tsx`, `components/checklist-badges.tsx`.

**Explicitly not M3c:** revision editor, releases UI, `preview`, Listening Simulator, ambience/music UI, Journal inbox.

---

## 3. Migrations, RLS, grants, security-definer

Schema for M3c entities already landed in M3a. Expect **few or no table DDL** changes. Proposed migration(s) only if review confirms the gaps below:

| Proposed file | Purpose |
|---|---|
| `2026……_m3c_audio_writer_upload.sql` (**if** A1 resolved toward DATA_MODEL §13) | Align `audio_assets` write policy with writer (and keep sound/editor/admin); today M2 policy is sound+ only while §13 and the M3c acceptance expect writer upload |
| `2026……_m3c_admin_geo_rpcs.sql` (**if** needed) | `fn_admin_upsert_grove` / `fn_admin_upsert_fragment_location` (`SECURITY DEFINER`, `has_role(editor,admin)`, geography from GeoJSON/WKT) — mirror M3b region RPC |
| `2026……_m3c_marker_helpers.sql` (**optional**) | Only if we keep generation in SQL; **default plan:** generate in the admin (TypeScript), no new definer |

**RLS / grants (no change unless A1 / A2 require it):**
- Groves, fragments (non–Story Notes columns), prereq groups/members: editor+ (already).
- Story Notes Indigeny: writer allowlist (M3b F1).
- Threads, characters, fragment_threads, fragment_characters: writer+ (already).
- Images: writer+ (already). Audio: see A1.

**`110_definer_grants.test.sql`:** if any new authenticated-callable definer lands (grove/fragment RPCs), add its signature to the allowlist array with a one-line why comment. Do **not** grant unguarded `fn_snapshot_projection` to authenticated (keep `fn_snapshot_projection_guarded` only).

**No new edge functions** for M3c authoring.

---

## 4. Storage: buckets, paths, auth, limits, sha dedupe

| Bucket | Path | Size limit (today) | Who |
|---|---|---|---|
| `staging-audio` | `{sha256}.{ext}` (row `staging_path` = `staging-audio/{sha}.{ext}`) | 50 MiB (`52428800`) | writer/sound/editor/admin (policy + §13; A1) |
| `staging-images` | `{sha256}.{ext}` | 50 MiB | writer/sound/editor/admin |
| `public-media` | `a/{sha}.{ext}`, `i/{sha}.{ext}` | 50 MiB | **service role only** via publish/reconcile (not admin) |

**Upload auth:** browser/session uses anon key + staff JWT; Storage RLS checks `has_role`. No service role in admin.

**Client flow (TECH_SPEC §4):**
1. Read file → compute **sha256** (hex) of bytes.
2. Measure metadata (audio: §5; image: width/height/ext).
3. `select` existing row by `sha256`; **on hit:** reuse asset id (dedupe); do not re-upload unless the staging object is missing.
4. On miss: `storage.from(bucket).upload(sha.ext, bytes)` then `insert` row with measured fields + `created_by = auth.uid()`.
5. Off-spec → still allow insert; show warnings (checklist codes `LOUDNESS` / `AUDIO_FORMAT` / `NO_ALT_TEXT`).

**Not in M3c:** moving objects to `public-media` (publish pipeline / M3d).

---

## 5. Audio analysis in the browser

**Decode:** `File` → `arrayBuffer` → Web Audio `AudioContext.decodeAudioData` → `AudioBuffer` (Float32 PCM per channel). Duration / channel count / sample rate from the buffer; bitrate from `file.size` and duration (or container parse where available). Extension from filename; reject UI for non-allowed `ext` check values.

**`packages/shared/src/audio/loudness.ts` (new in M3c; allowed by brief):** pure ITU-R **BS.1770-4** on interleaved or planar Float32:
- K-weighting → mean square per channel → channel weighting (mono / stereo) → **integrated loudness** (LUFS).
- **True peak:** 4× (or spec-compliant) oversampling peak → dBTP.
- Unit tests against **EBU Tech 3341** reference signals generated in-repo (±0.1 LU), per M3-admin decision 13.

**Stored on `audio_assets`:** `loudness_lufs`, `true_peak_dbtp`, `duration_ms`, `channels`, `sample_rate`, `bitrate_kbps`, `ext`, `bytes`, `sha256`, `kind`, `title`, `tags`, `staging_path`.

**Warning thresholds (AUDIO_SPEC §6 + DATA_MODEL §11):**

| Kind | Target loudness | Format expectations |
|---|---|---|
| narration | −16 LUFS, −1 dBTP | AAC `.m4a`, mono, 96 kbps, 44.1/48 kHz |
| sfx_oneshot | −24 LUFS (*short-term peak region* — see A3) | AAC mono/stereo, 128 kbps |
| sfx_bed | −30 LUFS | AAC stereo, 128 kbps |
| music_stem | −23 LUFS | AAC stereo, 160 kbps |
| voice_cue / growth_cue | −18 LUFS | AAC mono, 96 kbps |

- **`LOUDNESS` warning:** measured integrated LUFS more than **±2 LU** from the kind’s target, **or** loudness null.
- **`AUDIO_FORMAT` warning:** format / channels / bitrate disagree with the table (and sample-rate outside 44.1/48 where specified).
- Waveform: `wavesurfer.js` for display only; not a second loudness path.

---

## 6. Google Maps + Terra Draw

**Libraries (TECH_SPEC §1 — allowed; pin at implement time to then-current):**

| Package | npm at plan write |
|---|---|
| `@vis.gl/react-google-maps` | `1.10.2` |
| `terra-draw` | `1.40.0` |
| `terra-draw-google-maps-adapter` | `1.7.0` |
| `qrcode` (+ `@types/qrcode`) | `1.5.4` / `1.5.6` |
| `wavesurfer.js` | `8.1.0` |

Install from `apps/admin` with `pnpm exec expo install` **not** required (Next app); use workspace `pnpm add` in `apps/admin` and ask only if anything outside this allowlist appears (e.g. a graph layout lib — A7).

**Key / Map ID load:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAP_ID` from env (already in `.env.example`). Client: `APIProvider` only when key is non-empty; Map ID passed into `Map` / map options when present.

**Key restriction (M3b-review Verification):** admin Maps key is website-restricted to **`https://intell-admin.replaceplace.com`** and **localhost**. Therefore:

| Environment | Map | Authoring path |
|---|---|---|
| Localhost + production admin domain | Google map + Terra Draw polygons | Full UI |
| CI, Playwright, Vercel **preview** hosts | **No key / Maps blocked** | Grove boundary via **GeoJSON paste/upload**; fragments via **lat/lng** fields only |

Fallback component always mounts the GeoJSON + lat/lng editors; map is progressive enhancement. Playwright M3c acceptance **must not** require a Maps key (same rule as M3b).

---

## 7. Physical markers

**Generate:** server action (or client with `crypto.getRandomValues`) produces an **8-character** code from the unambiguous base32 alphabet in decision 12 (exact alphabet — A4). Store **plaintext** only in `fragments.marker_code` (unique; required when `visibility = 'physical'` via `fn_fragment_guard`).

**Hash:** packs and snapshots store `markerHash = encode(sha256(utf8(marker_code)), hex)` inside `fn_snapshot_projection` (already). QR / deep link match is by hash (TECH_SPEC §5). Admin print page uses the plaintext code only over the staff session.

**Print page:** `/print/marker/[fragmentId]`  
- QR payload: `https://{NEXT_PUBLIC_LINK_DOMAIN}/f/{code}` (`qrcode`).  
- Copy: fragment title (staff), code, and per M3a review **A20**: if working `sha256(code)` ≠ snapshot `markerHash`, show **“This code works once the fragment is released.”**

**Replacement:** editor sets a new `marker_code` on the working row. Live packs keep the previous hash until a release includes the fragment (staged edits). Old printed QR stops matching after that release goes live.

**Stay out of logs / Sentry / packs:**
- Never put `marker_code` in telemetry events, `console.log`, error breadcrumbs, or URL query strings (path is fragment id, not code).
- Pack zod + forbidden-fields tests already ban plaintext codes.
- Print route is staff-session only; no public print URL that embeds the code in a shareable path beyond the QR target host (listener domain), which is intentional for the physical object.

---

## 8. “Unreleased changes” marker (reuse M3a detection)

DATA_MODEL §8 / `054_staged_edits.test.sql`:

```
unreleased ⇔ fn_snapshot_projection_guarded(entity, id) IS DISTINCT FROM published_snapshots.data
```

**Admin usage in M3c:**
- For each grove / fragment / character / image row that has a `published_snapshots` row, call **`fn_snapshot_projection_guarded`** (authenticated allowlist) and compare to `published_snapshots.data` (JSON equality / `is distinct from` semantics mirrored in TS via canonical compare or by asking Postgres).
- Entities never published (no snapshot row) → show **Draft** (or no unreleased chip), not “Unreleased changes.”
- Story Notes fields are absent from projections → editing Indigeny / thread titles / character `notes` alone must **not** flip the marker (projection equality holds).
- Badge placement: grove list/detail, fragment rows, character rows (DESIGN §5).

No new SQL detection function required unless we add a convenience RPC later (would need `110` update).

---

## 9. `units.ts` and `timeWindow.ts`

| Module | Status on master | M3c work |
|---|---|---|
| `packages/shared/src/units.ts` (+ test) | **Present** — ft/m helpers, 15–35 ft / 4.57–10.67 m defaults | Wire admin radius controls to feet display / metre storage; extend tests only if UI needs new helpers |
| `packages/shared/src/time/timeWindow.ts` (+ test) | **Present** — `suncalc`, region sun reference, polar 06:00–18:00 fallback | No Day/Night version UI in M3c (revisions = M3d). Keep module green; admin may show region sunrise/sunset readout later — out of M3c acceptance unless needed for badges |

Acceptance explicitly requires both test files green; **do not regress**. `loudness.ts` is the new shared module in this milestone.

---

## 10. Test plan ↔ M3c acceptance

| Acceptance item | Unit (Vitest) | pgTAP | Integration | Playwright |
|---|---|---|---|---|
| Build a grove from GeoJSON with 3 fragments, an OR prereq group, one physical marker, and a prereq into the other seed grove | GeoJSON parse helpers; marker code generator alphabet/length | Existing `013_physical_marker`, `010_prereq_graph`; add admin-path smoke only if new RPCs | Optional: none new if RLS covered | **Required:** `e2e/m3c-grove-authoring.spec.ts` — editor session, **no Maps key**, GeoJSON + lat/lng, assert rows + print page + staged hash message when applicable |
| Off-spec upload shows loudness + format warnings | `loudness.ts` EBU 3341; format/threshold helpers | Checklist already has `LOUDNESS` / `AUDIO_FORMAT` in `030_checklist_codes` | — | Upload fixture wav/m4a off-target; assert warning UI |
| `loudness.ts` EBU 3341; `units.ts`; `timeWindow.ts` | **Required** shared tests | — | — | — |
| Writer can edit Story Notes + drafts but **not** groves/fragments | — | Extend / keep `063_rls_story_notes`, `064_m3b_staff_guards`, writer grove/fragment denial | — | Writer session: Indigeny/thread OK; grove create / fragment lat change / marker rotate **refused** (UI hidden + forced action) |
| Root checks green | shared + admin vitest | CI `db` job | CI integration | CI Playwright step |

Also: pack forbidden-fields / snapshot zod already ensure codes and Story Notes stay out of packs — keep those green; add a Playwright or unit assert that print page does not navigate with code in query string.

---

## 11. Ambiguities and contradictions (list only — do not resolve)

1. **Writer audio upload vs RLS:** DATA_MODEL §13 and M3c acceptance say writers upload audio; `audio_assets` RLS is still **sound/editor/admin** only (M2). Images already allow writer. Which wins for M3c?
2. **Grove/fragment geography writes:** M3b needed `fn_admin_upsert_region` for geography. Is an analogous grove/fragment RPC in scope, or must the admin write WKT via PostgREST without a new definer?
3. **sfx_oneshot loudness wording:** AUDIO_SPEC §6 says “−24 LUFS **short-term peak region**” while `LOUDNESS` compares **integrated** ±2 LU. Should oneshots use integrated, short-term, or both for the upload warning?
4. **Marker alphabet:** decision 12 says “unambiguous base32” but does not name Crockford vs RFC 4648 (no I/L/O/U) vs a custom set. Exact charset and case?
5. **Hash encoding:** snapshot uses `digest(marker_code, 'sha256')` on text — confirm UTF-8 bytes of the plaintext code with no normalization; any case-folding?
6. **`NEXT_PUBLIC_LINK_DOMAIN` value:** `.env.example` defaults `intell.replaceplace.com`; TECH_SPEC proposes the same; production admin host is `intell-admin.replaceplace.com`. Confirm print QR host is the **listener** link domain, not the admin host.
7. **Graph view dependency:** brief asks for a “graph view” of prerequisites; no graph library is on the TECH_SPEC §1 allowlist. SVG/hand-rolled vs approve a package?
8. **Checklist badges without a release:** grove editor should show validation badges from the checklist, but `fn_publish_check` takes a `release_id`. Ephemeral draft release, client-side subset, or new read-only check RPC?
9. **Character draft vs public fields:** writers may write `characters` rows; may they set `public_name` / `public_intro` / `portrait_image_id` / `status`, or only `notes` (Story Notes) until editor publishes fields? No column allowlist exists (unlike fragments).
10. **`fragment_characters` / card lines:** RLS allows writer+; brief lists card lines under Characters authoring. Can writers attach characters to fragments, or is that editor-only product intent?
11. **AAC decode in Chromium vs others:** admin Playwright uses Chromium (AAC OK); must upload analysis fail soft on browsers that cannot `decodeAudioData` for `.m4a`, or do we require Chromium-only for loudness?
12. **Bitrate measurement:** container bitrate vs `bytes * 8 / duration`. Which feeds `AUDIO_FORMAT`?
13. **Image limits:** bucket 50 MiB; any max width/height or forced `webp`/`png`/`jpg` only beyond the check constraint?
14. **Dedupe UX:** on sha hit, silently reuse vs prompt; may title/tags be updated on the existing row?
15. **Growth cue on grove:** grove form includes `growth_cue_id` in snapshots; is picking it in M3c or deferred with sound UI?
16. **Map ID required:** does `@vis.gl/react-google-maps` require `NEXT_PUBLIC_GOOGLE_MAP_ID` for vector/cloud styles, or is key-only enough for Terra Draw?
17. **Print route auth:** App Router — middleware already gates staff; should `/print/marker/*` use a minimal layout (no sidebar) and still block writers from rotating codes while allowing them to **view** codes (M3a amendment: any staff may see codes)?
18. **Staging go-live vs this plan:** M3b-review says JoJo still runs hosted `db push` / templates / env / bootstrap before day-to-day staging use. M3c plan assumes local/CI green; does implementation wait on staging smoke, or only on architect plan approval?
19. **True peak for mono vs stereo** channel weighting in BS.1770 vs EBU R128 — confirm which reference signals ship in fixtures (already implied ±0.1 LU, but fixture set not named).
20. **DESIGN §5 “Releases” under Story:** nav copy lists Releases with Story; M3c must omit Releases until M3d — confirm no stub/disabled item (M3b precedent: no disabled teases).

---

## Explicit non-goals

- M3d (revisions, releases UI, unpublish UI, `preview`)
- M4 sound design / Listening Simulator
- Mobile / Chronicle / Journal listener surfaces
- Any secret values, service role in admin, or Maps key in CI

**Stop for architect review. Do not implement M3c until this plan is approved.**
