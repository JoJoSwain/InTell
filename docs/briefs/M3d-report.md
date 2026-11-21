# M3d report — revisions, releases and preview

**Branch:** `m3d-releases`  
**PR:** https://github.com/JoJoSwain/InTell/pull/11  
**Tip (at report write):** see `git log -1 --oneline` on the branch after push  
**Plan:** `docs/briefs/M3d-plan.md` · **Review (wins):** `docs/briefs/M3d-plan-review.md` (`3da74e9`)  
**Stop for architect review of this report.**

---

## 1. Suite results

| Check | Result |
|---|---|
| `pnpm db:setup-local` | **PASS** — migrations through `20261121170001_m3d_review_e2_n1.sql` + seed + vault + seed-media |
| `pnpm exec supabase test db` | **PASS** — Files=**32**, Tests=**168** (includes `069`–`072` M3d) |
| `pnpm test:integration` | **PASS** — **20** tests (D1; preview anon/staff/viewer/**admin**; prior M3a) |
| Playwright (`apps/admin`) | **PASS** — **14** tests (E1 hard publish + GrovePack; E4 Bridge Start stranded; schedule/writer) |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** — shared Vitest **81**; admin Vitest **5** |
| `pnpm --filter @intell/admin build` | **PASS** |

Local preview edge: `supabase functions serve --env-file supabase/.env.local` (UTF-8 no BOM). Built-in edge alone returned 404 for new `preview` until serve was running.

---

## 2. What shipped

### Database (D1–D4 + draft-check parity)
- `20261121160001_m3d_revision_immutability.sql` — BEFORE triggers: non-draft `fragment_revisions` / `revision_versions` immutable for `authenticated`; D2 `BEFORE INSERT` assigns `revision_no` under fragment `FOR UPDATE`
- `20261121160002_m3d_unpublish_preview.sql` — `fn_stranded_prereqs`, `fn_unpublish_preview` (editor+); commit uses same helper
- `20261121160003_m3d_draft_check_revisions.sql` — `fn_check_revision_local`; `fn_draft_check` / `fn_publish_check` share it
- pgTAP: `069`, `070`, `071`; `110` allowlist updated for `fn_unpublish_preview` + revision_no assign helper

### Preview (D3)
- Shared assembler: `supabase/functions/_shared/packSource.ts` + overlay path in `buildGrovePack.ts`
- `supabase/functions/preview/` — staff JWT (writer/sound/editor/admin); statuses `draft`/`scheduled`/`failed`; 1h signed URLs; `PreviewManifest` schema `preview/1`
- Shared zod: `packages/shared/src/schemas/packs.ts` `PreviewManifest`

### Admin UI
- Revisions nested under `/story/groves/[groveId]/fragments/[fragmentId]/revisions` (+ `/new`, `/[revisionId]`); first revision Contingency locked; link from fragment form
- Releases under Story nav: list/create/detail — items (no sound types), checklist (`GroupedChecklist`), publish now, schedule (local time + zone abbr → UTC), cancel, retry, copy cancelled → draft, Check preview summary, Add missing items
- Unpublish: `fn_unpublish_preview` in confirm dialog **before** commit (grove/fragment/revision/character)

### Docs (review answers)
- DATA_MODEL §8 `publishing` meaning; §11 `PACK_BUILD_FAILED`; §12.5 preview shape/TTL/roles
- TECH_SPEC preview TTL + roles
- BUILD_PLAN M4: N3 loudness worker deferred from M3c

---

## 3. Review extras

### D1 trigger + integration
- pgTAP `069_m3d_revision_immutability.test.sql` — editor cannot edit/delete published; writer cannot add version to published; drafts editable; publish commit still moves status
- Integration: **D1: editing a published revision is refused; live pack unchanged** — **PASS**

### D3 shared assembler
- `build-pack` and `preview` both call `buildGrovePackObject` with optional `ReleaseOverlay` from `loadReleaseOverlay`
- `PreviewManifest` zod + unit test in `packs.test.ts`

### D4 preview/commit parity
- pgTAP `070_m3d_unpublish_preview.test.sql` — preview warnings equal `fn_stranded_prereqs` for same input

### Playwright
- From-scratch publish: **PASS** (new grove, physical + Day-only, Contingency revisions, release, checklist/add-missing, publish → publishing/published)
- Writer refusal: Publish absent + forced `publish` → **403** — **PASS**
- Schedule + checklist failures UI — **PASS**
- Unpublish confirm with stranded warnings (screenshot; cancel without committing) — **PASS**

### Screenshots
| File | What |
|---|---|
| `docs/briefs/m3d-screenshots/revision-first-contingency.png` | First revision Contingency locked |
| `docs/briefs/m3d-screenshots/release-checklist-grouped.png` | Checklist grouped by code |
| `docs/briefs/m3d-screenshots/release-checklist-failures.png` | Empty/failed checklist surface |
| `docs/briefs/m3d-screenshots/unpublish-confirm-stranded.png` | Unpublish confirm + stranded warnings |

---

## 4. Doc amendments (quoted)

**DATA_MODEL §8 status flow:** `publishing` means go-live in progress (check, copy, commit and pack builds), including when `fn_enqueue_due_releases` moves a due release there before the check; badge "Publishing…".

**DATA_MODEL §11:** `PACK_BUILD_FAILED` as a release-level error on `last_check`.

**DATA_MODEL §12.5:** PreviewManifest `preview/1`, 1-hour TTL, roles writer/sound/editor/admin, overlay assembler, no region pack, no marker codes / Story Notes.

**TECH_SPEC:** `preview` staff JWT + 1-hour signed URLs.

**BUILD_PLAN M4:** N3 O(n) short-term loudness + Web Worker carried from M3c.

---

## 5. Deviations

1. **N3** — moved to M4 per review answer 18 (not implemented in M3d).
2. Earlier soft-assert gaps on from-scratch publish are **closed by E1** (see Review fixes).

---

## 6. Open questions

ADR 0005 (on this branch as docs) settles the prior ADR 0004 opens except children's Journal privacy. M4 still owns sound-entity release items. **Do not start M3e here.**

---

## 7. Git log (branch commits since plan)

See `git log --oneline origin/master..HEAD` on `m3d-releases`. Implementation review: `docs/briefs/M3d-review.md` (`a9871d0`). ADR 0005 + M3e brief: `fdfe5c2` (docs only).

CI / Vercel: see **Review fixes** §N2 after the fix push.

---

## 8. Review fixes (`M3d-review.md` E1–E4 + nits)

**Reviewed against:** `docs/briefs/M3d-review.md` (Changes requested). Review wins. Tip after fixes: recorded on push.

### New commits since `f4d9448`
- `fdfe5c2` docs: ADR 0005 + spec amendments + M3e brief (docs only; not implemented)
- `a9871d0` docs: M3d implementation review
- *(this push)* E1–E4 + N1–N2 implementation, tests, report

### Suite after fixes
| Check | Result |
|---|---|
| `pnpm db:setup-local` / `db reset` | **PASS** — through `20261121170001_m3d_review_e2_n1.sql` |
| `pnpm exec supabase test db` | **PASS** — Files=**32**, Tests=**168** (adds `072_m3d_revision_release_guard`) |
| `pnpm test:integration` | **PASS** — **20** tests (adds admin preview) |
| Playwright | **PASS** — **14** tests (E1 from-scratch hard publish + GrovePack; E4 stranded Bridge Start) |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** |
| `pnpm --filter @intell/admin build` | **PASS** |

### E1 — from-scratch acceptance
- Playwright now builds a **new** grove with physical + Day-only, sets a **cross-grove prerequisite on seed Beginning**, publishes in **one** release, drains `run-jobs` until **Status: Published** (no `publishing \|\| published`), loads `get_pack_index`, downloads the manifest, and **`GrovePack.parse`s** it.
- Assertions: physical has `markerHash` (no code), Day-only revision has only `day`, `externalPrerequisites` lists Beginning.
- **Root cause of the earlier "Add missing" / soft-assert gap:** the e2e checklist loop raced `Run checklist` → `router.refresh()` and often published with only grove+revisions, leaving `DEPENDENCY_UNPUBLISHED` on the two fragments. Not an M4 sound-entity problem for a grove with no sound entities. Fix: add grove + **fragments** + revisions explicitly, then drain jobs and hard-assert `published` + zod.

### E2 — revision status / release_id bypass
- Migration `20261121170001_m3d_review_e2_n1.sql`: for `auth.role() = 'authenticated'`, INSERT requires `status = draft` and `release_id is null`; UPDATE refuses changes to `status` or `release_id`.
- pgTAP `072`: editor promote refused; published insert refused; `release_id` set refused; service-path publish/unpublish still works; writer insert still gets `revision_no` (N1).

### E3 — admin preview
- `preview` looks up staff with `auth.getUser()` + `.eq("user_id", …)`.
- Integration: **preview: admin can preview (staff lookup filtered by user_id)** — **PASS**.

### E4 — stranded warning visible
- Unpublish Playwright targets **fragment** Beginning; confirm dialog names **Bridge Start** (cross-grove) before Cancel.
- Screenshot `unpublish-confirm-stranded.png` replaced.
- Warnings now include fragment titles in the message.

### Nits
- **N1 fixed:** revoked `EXECUTE` on the three trigger functions from `authenticated`; removed `fn_fragment_revision_assign_no()` from `110` allowlist; `072` proves writer insert still gets `revision_no`.
- **N2 fixed:** CI/Vercel status recorded below after the fix-head push.

### Deferred nits
None — N1 and N2 done.

### CI / Vercel (N2)
- **PR head / E1–E4 tip:** `5c9318898525f5802ceec03aa4da1062887a2a5d` (`m3d-releases`). Verification commit `77a834a` is an ancestor of this tip, not the head.
- Tip `9c86629`: `check` green; `db` failed Playwright E1 — global `jobs` drain never emptied after integration leftovers. Fixed in `5c93188` by waiting on **this release’s** `published` status while calling `run-jobs`.
- Tip `5c93188` **fully green:** all CI checks success (`check`, `db`, Vercel Preview Comments × workflows). **Vercel:** Deployment has completed (success) — https://vercel.com/replaceplace/intell-admin/4jfAyGCrnhTLmD2iH4jxnUEVEQTn
