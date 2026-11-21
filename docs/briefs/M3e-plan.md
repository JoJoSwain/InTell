# M3e plan — story fields from ADR 0005

**Branch:** `m3e-story-fields` from `origin/master` @ `c7d16ea` (Merge pull request #11 / M3d)  
**Brief:** `docs/briefs/M3e-story-fields.md`  
**Wins on conflicts:** ADR 0005 → DATA_MODEL v3 (as amended) → this brief → this plan. ADR 0004 and the M3 brief still apply where not amended.  
**Stop after this plan** for architect review. **Do not implement** until approved.  
**No secret values** in this plan or in chat.  
**Plan-only PR** — no migrations, admin UI, seed, or pack-code changes in this PR.

---

## 1. Precondition results

| Check | Result |
|---|---|
| `git checkout master && git pull` | **PASS** — tip `c7d16ea` Merge pull request #11 from JoJoSwain/m3d-releases |
| M3d merge + ADR 0005 on master | **PASS** — `docs/adr/0005-listener-experience.md` present; `fdfe5c2` (ADR 0005) is an ancestor of `HEAD` |
| Branch `m3e-story-fields` cut from `origin/master` | **PASS** — tip `c7d16ea` |
| `pnpm db:setup-local` | **PASS** (with one retry) — `db reset` through `20261121170001_m3d_review_e2_n1.sql` + vault secrets OK; first `seed-media-upload` hit a transient `fetch failed` right after container restart; retry of `node tools/seed-media-upload.mjs` uploaded 22 staging-audio + 2 portraits |
| `pnpm exec supabase test db` | **PASS** — Files=**32**, Tests=**168** |
| `pnpm test:integration` | **PASS** — **20** tests |
| Playwright (`apps/admin`) | **PASS** — **14** tests (after `e2e:prepare` + exporting `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_*` from `supabase status -o env`, matching CI) |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** — lint/typecheck clean; shared Vitest **81**; admin Vitest **5** |

Working tree at plan write: this plan file only (no implementation).

---

## 2. Migration list (order)

New migrations only. Never edit merged migrations. Proposed filenames (timestamps TBD at implement time; keep this relative order):

| # | Proposed file | Purpose |
|---|---|---|
| 1 | `…_m3e_journey_mode_and_journeys.sql` | Create enum `journey_mode as enum ('walk','bike','transit')` (**no `drive`**). Create `grove_journeys (grove_id, mode, passage jsonb not null default '{}', created_at, updated_at, primary key (grove_id, mode))` with FK `grove_id → groves(id) on delete cascade`, `set_updated_at` trigger, and **split RLS** (B1): staff `SELECT`; writer+ `INSERT`/`UPDATE`/`DELETE` with matching `USING`/`WITH CHECK` via `has_role`. |
| 2 | `…_m3e_story_columns.sql` | `alter table characters add column home_grove_id uuid references groves(id)`; `alter table fragment_revisions add column change_teaser jsonb not null default '{}'`; `alter table revision_versions add column other_time_hint jsonb not null default '{}'`; `alter table groves drop column access_notes`. |
| 3 | `…_m3e_projection_and_opening.sql` | Rewrite `fn_snapshot_projection`: grove — drop `accessNotes`, nest `journeys` from `grove_journeys` as `{walk?, bike?, transit?}` L10n; character — add `homeGroveId`, keep `portraitImageId`. Add `pack_builds` opening storage (see §3 / A1). Rewrite `get_pack_index` to return `opening: {lat, lng}` on grove rows from that storage. |
| 4 | `…_m3e_checklist_helpers.sql` | Shared helpers (service_role only) for `NO_PORTRAIT`, `NO_HOME_GROVE`, `NO_CHANGE_TEASER`, `NO_TIME_HINT`, `NO_ROOT`; wire into **both** `fn_publish_check` and `fn_draft_check`. Extend `DEPENDENCY_UNPUBLISHED` so a character's home grove must be published or in the same release (DATA_MODEL §10). |
| 5 | `…_m3e_definer_grants.sql` (**only if needed**) | Append any new authenticated definer to the `110` allowlist with a one-line why. Prefer keeping helpers service_role-only (M3c/M3d pattern). Expect **no** change if opening storage is written by `build-pack` (service role) and index stays the existing `get_pack_index()` signature. |

**Seed** (`supabase/seed.sql`, not a migration): remove every `access_notes` column reference; set each seed character's `home_grove_id` (+ keep portraits); add `change_teaser` on contingency revisions after revision 1; add `other_time_hint` on both versions where Day+Night exist; insert `grove_journeys` for the Farmington seed grove for all three modes with plainly labelled placeholder L10n (e.g. `{en: "TEST walk journey …"}`). No `drive` label, copy, or placeholder.

**Types:** regenerate `packages/shared/src/db.ts` after migrations.

---

## 3. Projection, `build-pack`, and index (opening point)

### 3.1 Snapshot projection

| Entity | Change |
|---|---|
| `grove` | Remove `accessNotes`. Add `journeys: { walk?: L10n, bike?: L10n, transit?: L10n }` from `grove_journeys` (omit modes with empty `{}` / empty `en`, matching other optional L10n). Status and other fields unchanged. Journeys are **staged with the grove**: working-table edits reach packs only when the grove is in a release and `fn_publish_commit` rewrites the grove snapshot. |
| `character` | Add `homeGroveId` (nullable in working rows; required to release). Keep `portraitImageId`. |
| `fragment` / others | Unchanged for M3e. |

`change_teaser` and `other_time_hint` live on revision / version rows (not snapshots). Pack assembly reads them from the current playable revision (and, for the teaser, from the contingency revision — §3.2).

### 3.2 `buildGrovePack` / schema 3

In `supabase/functions/_shared/buildGrovePack.ts` (+ synced shared zod):

- Emit `schema: 3`.
- Grove object: drop `accessNotes`; add `openingFragmentId` (first fragment with `tier === 'root'`, status published/retired, ordered by `storyOrder` then `id`); add `journeys` from the grove snapshot.
- Characters: require `homeGroveId`, `portraitSha`, `portraitAlt` in the emitted object (zod will require them). Source `homeGroveId` from the character snapshot.
- Revisions: when `contingencyRevisionNo > 1`, set `changeTeaser` from **the revision row whose `revision_no` equals `contingencyRevisionNo`**, even if the current playable revision is a later correction. Omit when `contingencyRevisionNo === 1`.
- Versions: include `otherTimeHint` when non-empty (pack may omit empty; checklist requires both when Day+Night exist).
- `PreviewManifest` continues `schema: "preview/1"` but its `groves[]` are GrovePack **schema 3**.

Canonical JSON / deep-sort / coord rounding rules unchanged. Drift-check (`db:check-edge-shared`) must stay green after syncing `packs.ts` / snapshots.

### 3.3 Opening point storage and `get_pack_index`

**Proposed (matches brief suggestion; confirm A1):**

1. Add nullable columns on `pack_builds`, e.g. `opening_lat double precision`, `opening_lng double precision` (or one `opening jsonb` — A1).
2. At persist time (`packPersist` / build-pack), after assembling the grove pack, resolve the opening fragment's `lat`/`lng` from the pack fragments (same id as `openingFragmentId`), round to 6 decimals, and write them on the new `pack_builds` row.
3. `get_pack_index()` adds `opening` to grove entries as `{lat, lng}` when both columns are non-null; omit for region rows and for any legacy build without opening (should not appear after first post-M3e rebuild of every live grove).

**Why not compute only at index time from snapshots:** the brief asks build-pack to record it so the index can stay a thin read of live builds; also keeps embark nearest-grove math independent of re-deriving story order in SQL.

**NO_ROOT:** if a grove in the release (or under `fn_draft_check`) has no published/non-retired root, checklist fails and build-pack must not invent an opening (persist leaves opening null; index omits it — A2).

### 3.4 Staged journey edits

Integration acceptance: edit a published grove's `grove_journeys.passage` → live pack / index unchanged until that grove is included in a release that publishes. Same pattern as other grove snapshot fields (M3a staged edits).

---

## 4. Zod schema-3 diff

File: `packages/shared/src/schemas/packs.ts` (and `snapshots.ts`, `l10n.ts` tests).

| Location | Schema 2 (today) | Schema 3 (M3e) |
|---|---|---|
| `GrovePack.schema` | `z.literal(2)` | `z.literal(3)` |
| `grove.accessNotes` | `AccessNotes` required | **removed** |
| `grove.openingFragmentId` | — | `Uuid` required |
| `grove.journeys` | — | `z.object({ walk: L10n.optional(), bike: L10n.optional(), transit: L10n.optional() }).strict()` (all optional; no `drive`) |
| `characters[]` | `portraitSha?`, `portraitAlt?` | add required `homeGroveId: Uuid`; `portraitSha` + `portraitAlt` **required** |
| `revisions[]` | — | `changeTeaser?: L10n` |
| `revisions[].versions[]` | — | `otherTimeHint?: L10n` |
| `PackIndexEntry` | no opening | `opening?: { lat: number, lng: number }` (grove rows only in practice) |
| `PreviewManifest.groves` | `GrovePack` (follows schema bump) | schema-3 packs |
| `AccessNotes` in `l10n.ts` | used by packs + snapshots | **remove** type + tests once nothing references it (A3) |
| Snapshot `grove` | has `accessNotes` | drop; add `journeys` |
| Snapshot `character` | `portraitImageId?` | add `homeGroveId?` (nullable until release) |

Fixtures / `packs.test.ts`: rewrite happy-path fixture to schema 3; keep forbidden-fields test (reject `markerCode`; still no Story Notes); add assertion that `accessNotes` / `drive` are rejected; contingency+correction fixture carries contingency's `changeTeaser`.

---

## 5. Admin changes

| Surface | Change |
|---|---|
| **Character page** (`/story/characters/[id]`) | Home-grove picker (published + draft groves writers can see — A4). Mark portrait as required to release. Relabel `public_intro` control to **"Back story"** (no column rename). Persist `home_grove_id`. |
| **Revision editor** | **Change teaser** L10n field: show + require UI when `change_kind = contingency` and `revision_no > 1` (or after assign-no, when not the fragment's first revision). Help: *"Shown to listeners when they tap a fragment whose story has changed."* Editable only while revision is `draft` (M3d immutability already blocks published updates). **Other-time hint** per version: show when the revision has (or is adding) both Day and Night; short example in help (ADR 0005: *"After dusk, River speaks of something else."*). |
| **Grove editor** | Remove access-notes field, actions parsing, and copy. Add **Journey passages** section: three optional fields labelled **On foot**, **By bike**, **By transit** (map to `walk`/`bike`/`transit`). Help: *"Shown in Embark after a listener picks how to travel. Link this way of arriving to the grove's opening root."* No driving control, label, or placeholder. |
| **Checklist badges / deep links** | Render new codes. Extend `entityAdminHref` / message links so: `NO_HOME_GROVE` / `NO_PORTRAIT` → character page; `NO_CHANGE_TEASER` / `NO_TIME_HINT` → revision editor (need groveId+fragmentId in link context — A5); `NO_ROOT` → grove fragments. |
| **i18n / a11y** | All new strings through admin i18n patterns already used; every control labelled; no AI suggest UI. |

Out of scope UI: Embark, pulsing marker, Chronicle cards (M5/M8).

---

## 6. Test plan ↔ acceptance

| Acceptance item | pgTAP | Integration | Playwright | Unit / other |
|---|---|---|---|---|
| Each new code fires and clears; `fn_publish_check` ↔ `fn_draft_check` parity | New `07x_m3e_*.test.sql`: assert helpers + both check fns agree for `NO_PORTRAIT`, `NO_HOME_GROVE`, `NO_CHANGE_TEASER`, `NO_TIME_HINT`, `NO_ROOT` | — | Release missing required field fails with matching code + deep link | — |
| `grove_journeys` RLS (viewer refused; writer allowed) | Role-matrix / dedicated RLS test | — | Writer can fill journeys | — |
| B1 for-all guard stays green | Existing B1 coverage + new table uses split policies | — | — | — |
| No `drive` in `journey_mode` | `SELECT enum_range(NULL::journey_mode)` equals `{walk,bike,transit}` | — | No drive UI | zod rejects `drive` |
| `access_notes` gone | Column absence + projection without `accessNotes` | Pack has no `accessNotes` | Grove form has no access notes | `AccessNotes` removed; fixtures updated |
| Schema-3 pack: `openingFragmentId`, `journeys`, `homeGroveId` | — | Publish grove → GrovePack `schema === 3` with those fields | From-scratch / seed path still publishes | zod parse |
| `get_pack_index` returns `opening` | Index shape for live grove | Assert `opening.lat/lng` match opening root | — | `PackIndexEntry` optional opening |
| Contingency then correction keeps contingency `changeTeaser` | Optional SQL fixture | Explicit integration case | — | pack fixture |
| Staged journey edit does not change pack until release | — | Edit passage on published grove → content sha / journeys unchanged until release | — | — |
| Writer fills journeys, home grove, change teaser, both hints | — | — | New or extended M3e spec | — |
| Farmington seed → valid schema-3 pack | Seed graph still green | Rebuild / existing seed publish path validates schema 3 | — | — |
| Every CI job green | `db` job | integration + Playwright in `db` job | same | `check` job lint/typecheck/test |

---

## 7. Ambiguities (do not resolve silently)

1. **A1 — `pack_builds` opening column shape.** Two floats (`opening_lat` / `opening_lng`) vs one `opening jsonb` `{lat,lng}`. Brief only says “records it on the grove's `pack_builds` row.”
2. **A2 — Build/index behaviour when `NO_ROOT`.** Refuse pack build, write build with null opening, or rely solely on checklist blocking publish? Index omit vs error.
3. **A3 — Delete `AccessNotes` zod entirely** vs leave unused deprecated export for one milestone.
4. **A4 — Home-grove picker contents.** All groves, only same-region, only non-retired, include unpublished drafts?
5. **A5 — Deep links for revision-scoped codes.** Today `entityAdminHref('revision', id)` returns null without grove+fragment context. Failures need richer `entity` payload, a lookup RPC, or message-only links for M3e.
6. **A6 — Empty L10n rule.** Mirror `NO_TEASER` (`{}` or blank `en` ⇒ fail) for `change_teaser`, `other_time_hint`, and journey omission — confirm identical predicate.
7. **A7 — `NO_ROOT` fragment set for `fn_draft_check`.** Count working draft roots, or only statuses that would appear in a pack (`published`/`retired`)? A grove with only draft roots is common while authoring.
8. **A8 — `NO_ROOT` / character checks scope in `fn_publish_check`.** Only entities in `release_items`, or also linked characters/fragments pulled in by DEPENDENCY rules?
9. **A9 — Characters in pack without portrait/homeGrove.** Zod requires both; build-pack today omits missing portrait fields. After M3e, skip incomplete characters (should be impossible post-checklist) or fail the build hard?
10. **A10 — `homeGroveId` may reference another grove.** Pack character entry still carries that foreign id; phone Chronicle (M8) interprets it. Confirm no same-grove constraint.
11. **A11 — Legacy live schema-2 packs.** After deploy, do we require a no-op/re-release rebuild of every live grove before phones expect schema 3, or is mixed index (some builds without `opening`) acceptable until next content release?
12. **A12 — Published snapshots still containing `accessNotes`.** Until those groves are re-released, old snapshot JSON keeps the key; new `parseSnapshot` must ignore unknown keys or strip on read. Confirm `.strict()` snapshot parse strategy.
13. **A13 — Journey passages and release items.** Journeys are only via grove snapshot (no `release_items` entity `journey`). Confirm: releasing a grove is sufficient; no separate item type.
14. **A14 — Correction revisions and `change_teaser` column.** Corrections after contingency 1: column defaults to `{}` and is unused in pack; UI hidden. Any checklist noise to suppress?
15. **A15 — Other-time hint when only one window exists.** Field hidden; empty OK; pack omits. If writer later adds the second window on a draft revision, both become required — confirm draft_check catches that before publish.
16. **A16 — `PackIndexEntry` opening required vs optional.** Optional is safer for region rows and mid-migration; Embark (M5) must treat missing opening as “not embarkable.”
17. **A17 — Admin Playwright env on Windows.** Local runs need the same env export as CI (`ANON_KEY` into `NEXT_PUBLIC_SUPABASE_ANON_KEY`); first bare `test:e2e` timed out because Playwright's `webServer.env` overrode `.env.local` with an empty anon key. Document in implement report; not a product ambiguity.
18. **A18 — Whether `fn_snapshot_projection_guarded` needs a contract test** that journeys appear and `accessNotes` does not (beyond pack integration).

---

## 8. Explicit non-goals (this milestone)

- No `embark` relay, Routes API key, mobile UI, pulsing marker, or `embark_usage` (M5).
- No Chronicle character-card / other-time-hint UI (M8).
- No car, parking, or arrival-logistics replacement for `access_notes`.
- No AI generation of passages, teasers, or hints.
- **This PR:** plan document only — stop for architect review.

---

## 9. Implement-later report checklist (after approval)

Per brief “Report back with”: `git log --oneline`; db reset / pgTAP / integration / Playwright / root checks; schema-3 zod diff; doc amendments quoted; deviations; open questions. Not produced in this plan-only PR.
