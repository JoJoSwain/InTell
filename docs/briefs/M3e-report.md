# M3e report — story fields from ADR 0005 (GrovePack schema 3)

**Branch:** `m3e-story-fields`  
**PR:** https://github.com/JoJoSwain/InTell/pull/14  
**Tip:** see latest on `m3e-story-fields` after Review fixes  
**Plan:** `docs/briefs/M3e-plan.md` · **Plan review:** `docs/briefs/M3e-plan-review.md` (`d7f3026`) · **Impl review:** `docs/briefs/M3e-review.md` (`b1d9200`)  
**Stop for verification after Review fixes.** Do not start M3f, M4, or M5.

---

## 1. Suite results

| Check | Result |
|---|---|
| `pnpm db:setup-local` | **PASS** — migrations through `20261121180004_m3e_checklist_helpers.sql` + seed |
| `pnpm exec supabase test db` | **PASS** — Files=**35**, Tests=**194** (includes `073`–`075` M3e) |
| `pnpm test:integration` | **PASS** — **21** tests (schema-3 pack, index `opening`, contingency `changeTeaser`, staged journey) |
| Playwright (`apps/admin`) | **PASS** — **16** tests (incl. `m3e-story-fields.spec.ts`: fill fields + checklist deep links) |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** — shared Vitest **83**; admin Vitest **5** |
| `pnpm --filter @intell/admin build` | **PASS** |
| CI (`check` + `db`) on tip | **PASS** |
| Vercel preview on tip | **PASS** (`Deployment has completed`) |

CI note: tip `0d08c8e` failed admin typecheck (`webServer.env` as `ProcessEnv`); fixed in `37c05c9` by building a `Record<string, string>`.

---

## 2. Git log (`origin/master..HEAD`)

```
37c05c9 fix(admin): type Playwright webServer.env as Record<string, string>
0d08c8e feat(m3e): story fields from ADR 0005 (schema 3)
d7f3026 docs: add M3e plan review
70262a2 docs: add M3e story-fields plan (plan-only)
```

---

## 3. Migrations (order)

1. `20261121180001_m3e_journey_mode_and_journeys.sql` — `journey_mode` (`walk`/`bike`/`transit` only); `grove_journeys` + split RLS + `set_updated_at`
2. `20261121180002_m3e_story_columns.sql` — `characters.home_grove_id`; `fragment_revisions.change_teaser`; `revision_versions.other_time_hint`; drop `groves.access_notes`
3. `20261121180003_m3e_projection_and_opening.sql` — `fn_l10n_blank`; `pack_builds.opening_lat`/`opening_lng` (+ pair check); strip `accessNotes` from published grove snapshots (A12); `fn_snapshot_projection` + `get_pack_index` updates
4. `20261121180004_m3e_checklist_helpers.sql` — `fn_check_issue` context payload; character/revision/fragment local checks; `NO_ROOT` draft vs publish; draft/publish parity

---

## 4. Review corrections G1–G3

| Id | What landed |
|---|---|
| **G1** | Opening root = first `root` with `status = 'published'` only, ordered by `story_order` then `id`. Build refuses with `PACK_BUILD_FAILED` if none (A2). Never invents an opening. |
| **G2** | Shared blank rule: SQL `fn_l10n_blank(jsonb)` + TS `isL10nBlank`. Used by checklist codes and pack/projection omit rules. `AccessNotes` zod deleted entirely (A3). |
| **G3** | Checklist failures may carry `grove_id` / `fragment_id` / `character_id`; admin deep links use that context. |

Also: A1 opening columns + index field; A4 home-grove picker across non-unpublished groves; A7/A8 `NO_ROOT` semantics; A14 contingency-only `NO_CHANGE_TEASER`; A15 both hints when Day+Night; A16 optional `opening` on `PackIndexEntry`; A17 Playwright env fix + admin README note; A18 projection contract pgTAP.

---

## 5. Schema-3 zod diff (as implemented)

`GrovePack.schema`: `2` → **`3`**.

| Area | Change |
|---|---|
| `grove` | **Removed** `accessNotes`. **Added** `openingFragmentId: Uuid`, `journeys: { walk?, bike?, transit? }` (strict). |
| `characters[]` | **Required** `portraitSha`, `portraitAlt`, `homeGroveId`. |
| `revisions[]` | **Added** `changeTeaser?: L10n` (omitted when contingency revision no = 1). |
| `versions[]` | **Added** `otherTimeHint?: L10n`. |
| `PackIndexEntry` | **Added** `opening?: { lat, lng }` (optional; region rows omit). |
| Snapshots | `GroveSnapshot`: `journeys`, no `accessNotes`. `CharacterSnapshot`: `homeGroveId?`. |
| L10n | **Deleted** `AccessNotes`. **Added** `isL10nBlank`. |

---

## 6. pgTAP (M3e files)

| File | Plan | Covers |
|---|---|---|
| `073_m3e_journey_rls.test.sql` | 6 | `journey_mode` has no `drive`; viewer insert refused; writer upsert allowed; B1 split policies |
| `074_m3e_checklist_codes.test.sql` | 15 | `NO_PORTRAIT`, `NO_HOME_GROVE`, `NO_CHANGE_TEASER`, **A15** day-only → add night → `NO_TIME_HINT` (draft + publish parity), `NO_ROOT`, G2 blank teaser, `fn_l10n_blank`, A14 corrections skip change teaser, G3 context keys |
| `075_m3e_projection_contract.test.sql` | 5 | **A18** grove projection has `journeys` and no `accessNotes`; character has `homeGroveId`; `pack_builds` opening columns exist |

Total suite after M3e: **35 files / 194 tests**.

---

## 7. Integration

- Demo grove pack validates as **schema 3** with `openingFragmentId`, three `journeys`, character `homeGroveId`.
- `get_pack_index` returns grove `opening.{lat,lng}` matching the opening root point.
- Contingency then correction: pack `changeTeaser` comes from the contingency revision (`contingencyRevisionNo`), not the later correction.
- Staged journey edit on a published grove does **not** change the live pack until the grove is re-released.

---

## 8. Playwright

`apps/admin/e2e/m3e-story-fields.spec.ts`:

1. Writer fills Journey passages (On foot / By bike / By transit), character home grove + Back story/portrait labels, change teaser, both other-time hints.
2. Release missing required fields fails with matching codes and working deep links (`grove_id` / `fragment_id` / `character_id`).

Screenshots (also under store `media/m3e/`):

| File | What |
|---|---|
| `apps/admin/e2e/screenshots/m3e-grove-journeys.png` | Grove editor Journey passages (walk/bike/transit; no drive) |
| `apps/admin/e2e/screenshots/m3e-character-home-grove.png` | Character page: home grove picker, Back story, portrait required |
| `apps/admin/e2e/screenshots/m3e-revision-change-teaser.png` | Revision editor: change teaser + other-time hints |
| `apps/admin/e2e/screenshots/m3e-release-checklist-codes.png` | Release checklist showing new codes / deep links |

---

## 9. Doc amendments (quoted)

**DATA_MODEL §11 — blank L10n (G2):**

> `fn_l10n_blank(jsonb)` (and the matching TypeScript `isL10nBlank`) is true for `{}`, a missing `en`, or an `en` that's blank after trimming. Checklist codes that require authored text (`NO_TEASER`, `NO_CHANGE_TEASER`, `NO_TIME_HINT`, `NO_ALT_TEXT`) use this predicate. Snapshot and pack assembly omit blank journey passages and other-time hints the same way.

**DATA_MODEL §11 — deep-link context (G3):**

> Issue objects may carry optional `grove_id` / `fragment_id` (fragment-, revision- and version-scoped codes) and `character_id` (character codes) so the admin can deep-link to the field that fixes the failure. Older callers that only set `entity` + `entity_id` remain valid.

**DATA_MODEL §12.3 — opening columns:**

> For grove rows, `opening: {lat, lng}` is the published opening root's point (M3e), so the phone can find the nearest grove for Embark without downloading every grove pack. **Storage:** `pack_builds` carries nullable `opening_lat` / `opening_lng` (both null or both set). `build-pack` writes them from the opening root after assembling a grove pack; the index reads them. Region rows and builds without an opening omit the field.

Admin README Playwright section notes A17: `webServer.env` only passes through set variables so it never overrides `.env.local` with empty `NEXT_PUBLIC_SUPABASE_*`.

---

## 10. Deviations

1. **CI typecheck follow-up** — A17's first `ProcessEnv` typing failed CI/Vercel; narrowed to `Record<string, string>` in `37c05c9` (behavior unchanged).
2. No other scope creep. No `drive` / cars. No AI generation. No mobile / Embark / Chronicle (M5/M8).

---

## 11. Open questions

None blocking M3e. Items deferred by design (review Notes):

- Physical opening root → Embark routes to the point and story begins with a scan — record in the **M5** brief.
- Phone features (Embark, pulsing marker, Chronicle cards/hints) remain **M5 / M8**.

**Ready for architect review. Do not start M4 or M5 from this branch.**

---

## 12. Review fixes (`M3e-review.md` R1 + N1)

**Reviewed against:** `docs/briefs/M3e-review.md` (Approved after R1). Review wins.

### Commits since `90f6aa0`
- `b1d9200` docs: M3e implementation review; M3f brief (not started)
- *(this push)* fix R1 journey soft-nav doubling + N1 preview 422; tighten Playwright exact assertions; update this report

### R1 — journey passage doubling
**Finding: real bug (display + stored), not only a screenshot artifact.**

Soft navigation after `saveGroveJourneys` restored prior form field values into the remounted textareas (same `name`s). The next save then upserted the concatenated string. Playwright’s old `/E2E on foot/` regex hid it; the DB row for walk accumulated multiple E2E strings across runs.

**Fix:**
- `saveGroveJourneys` returns `{ ok, groveId }` (no soft `redirect`)
- `JourneyForm` submits via `useTransition`, then **hard** `window.location.assign(...?journeys=<ts>)`
- Grove page passes `remountKey` from that query param; form/fields remount with server `defaultValue`
- Submit button disabled while pending
- Playwright: unique copy per run, clear+fill, assert **exact** values after save URL and after reload, assert `grove_journeys.passage.en` exactly; same exact-value + reload pattern for change teaser and other-time hints (revision create already hard-changes URL; pending submit button added)

Screenshots regenerated (`m3e-grove-journeys.png` shows a single On foot passage).

### N1 — preview incomplete character
**Done.** `buildGrovePackObject` errors now include the character public name. `preview` catches missing home grove / portrait and returns **422** with e.g. `"River needs a home grove before preview."` Integration: `preview: incomplete character returns 422 with clear message (N1)`.

### Suite / CI
Local after fixes: db reset + pgTAP 35/194; integration **22**; Playwright M3e both green (full 16 with one staff-gate retry for transient 503); lint/typecheck/test/admin build green. CI/Vercel: see tip after push.
