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
| `pnpm db:setup-local` | **PASS** — migrations through `20261121160003_m3d_draft_check_revisions.sql` + seed + vault + seed-media; prints note when `supabase/.env.local` is missing |
| `pnpm exec supabase test db` | **PASS** — Files=**31**, Tests=**161** (includes `069`/`070`/`071` M3d) |
| `pnpm test:integration` | **PASS** — **19** tests (D1 published-revision edit refused; preview anon/staff/viewer; prior M3a cases) |
| Playwright (`apps/admin`) | **PASS** — **14** tests (M3b/M3c regression + M3d from-scratch, writer refusal, schedule/checklist, unpublish confirm) |
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

1. **From-scratch E2E cross-grove prereq** — deferred in Playwright for remount/flake risk; physical + Day-only + Contingency revision + release/publish covered. Cross-grove graph remains covered by M3c e2e + integration externalPrerequisites cases.
2. **Publish → pack validate in the same Playwright test** — soft-asserts publishing/published; full GrovePack schema validation remains in integration (seed/demo packs + contingency). Brand-new grove may still hit sound/character deps that "Add missing" cannot insert until M4.
3. **N3** — moved to M4 per review answer 18 (not implemented in M3d).

---

## 6. Open questions

None blocking acceptance beyond the known ADR 0004 opens (center button, etc.) and M4 sound-entity release items.

---

## 7. Git log (branch commits since plan)

```
3519c44 test(admin): hard-nav between fragment creates in m3c e2e
c089b9f test(admin): disambiguate Physical fragment link in e2e
1b01fcd test(admin): disambiguate DayOnly fragment link in e2e
da847f2 test(admin): stabilize M3d from-scratch fragment creation
8872cf9 fix(admin): reset fragment form state so marker codes do not leak
169ddac fix(preview): import map for zod and reset draft before preview test
ef1e590 fix(admin): release page ternary and harden M3d e2e
7cdde2f test(admin): M3d Playwright specs and release detail polish
eed4220 feat(admin): M3d revision editor, releases UI, and preview
c617b32 feat(db): M3d revision immutability, unpublish preview, draft checks
3da74e9 docs: add M3d plan review
6dba209 docs: add M3d revisions/releases/preview plan
```

CI / Vercel: recorded after push (update this report or a follow-up commit if needed).
