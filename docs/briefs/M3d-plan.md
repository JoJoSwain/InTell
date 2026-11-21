# M3d plan — revisions, releases and preview

**Branch:** `m3d-releases` from `origin/master` @ `f71e202` (Merge pull request #9 / M3c; contains `b0a0b53`)  
**Brief:** `docs/briefs/M3-admin.md` § M3d + decisions 3–5, 13; BUILD_PLAN M3 accept  
**Wins on conflicts:** ADR 0004 → DATA_MODEL / AUDIO_SPEC / TECH_SPEC → M3 brief → this plan  
**Carry-forward:** M3c-review **Accepted** — M3d must add revision/audio rules to `fn_draft_check` through the shared helpers; **N3** deferred from M3c (see §7)  
**Stop after this plan** for architect review. **Do not implement** until approved.  
**No secret values** in this plan or in chat.

---

## 1. Precondition results

| Check | Result |
|---|---|
| `git checkout master && git pull` | **PASS** — tip `f71e202` Merge pull request #9 from JoJoSwain/m3c-authoring |
| PR #9 merged into master | **PASS** — `merged_at` 2026-11-21; merge SHA `f71e202` |
| `b0a0b53` ancestor of `master` | **PASS** (`git merge-base --is-ancestor`) |
| Branch `m3d-releases` cut from `origin/master` | **PASS** — tip `f71e202` |
| `pnpm db:setup-local` | **PASS** — migrations through `20261121140005_m3c_geojson_computed.sql` + seed + vault + seed-media upload |
| `pnpm exec supabase test db` | **PASS** — Files=**28**, Tests=**148** |
| `pnpm test:integration` | **PASS** — **16** tests (built-in edge runtime after `supabase start`; separate `functions serve` not required once edge container is healthy — see note) |
| Playwright (`apps/admin`) | **PASS** — **10** tests |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** — shared Vitest **80**; admin Vitest **5**; lint/typecheck clean |

**Edge-runtime note (Windows):** after `db reset`, the edge container can be briefly absent and `supabase functions serve --env-file supabase/.env.local` fails when that file is missing (gitignored; same as M3a C5). On this host, a clean `supabase stop` / `supabase start` + `db:setup-local` left `supabase_edge_runtime_Replaceplace` healthy; `POST /functions/v1/run-jobs` returned **200**. Integration then passed without a second `functions serve` process. CI still starts `functions serve &` in parallel — keep that.

Working tree at plan write: plan file only (no implementation).

---

## 2. Routes, pages and components — server action vs edge vs RLS

Nav (DESIGN §5): add **Releases** under Story (M3c confirmed no stub until M3d). Keep Media / Ops. Omit Sound / Journal / Simulator until M4 / M9.

| Area | Routes / UI | Server action | Edge function | Direct RLS / storage |
|---|---|---|---|---|
| **Revision editor** | Nested on grove fragment: `/story/groves/[id]` revision panel **or** `/story/groves/[groveId]/fragments/[fragmentId]/revisions/[revisionId]` (prefer nested under grove detail to reuse M3c fragment context — see A1). Form: Day and/or Night versions; narration asset picker (existing audio library); transcript textarea (staff-typed only); `change_kind` required radios (no default); change note; Contingency/Correction chips (DESIGN §5) | Server actions → user client: insert/update draft `fragment_revisions` + `revision_versions`; assign next `revision_no`; enforce first-revision contingency in UI **and** rely on DB check | **None** | Writers: insert + update draft/`in_review` revisions; versions writer+. Editors: same + delete. Status → `published` **only** via publish commit (writers must not set `published`) |
| **Releases list / create** | `/story/releases`, `/story/releases/new` | Create draft release (name, notes) via user client | **None** | `releases` / `release_items`: editor+ write; all staff read |
| **Release detail: items** | `/story/releases/[id]` — add/remove items (revision, grove, fragment, character, image; sound entity types exist in schema but **no picker UI** until M4 — see A2). Convenience: “add missing items” from checklist `DEPENDENCY_UNPUBLISHED` (DATA_MODEL §10) | Server actions mutate `release_items` | **None** | RLS editor+ |
| **Checklist** | Same page: run check, group failures by `code` then entity; each row links to the fixing field/route; warnings listed but non-blocking | Call **`fn_publish_check(release_id)`** (authenticated allowlist, editor+ guard inside fn today — see A3) via server action or client RPC; persist `last_check` already written by the fn | **None** for dry-run | Definer grant already in `110` |
| **Publish now** | Editor+ button; writer: button **absent** | Prefer thin server action that invokes edge with session JWT | **`publish`** (existing): check → copy staging→public → `fn_publish_commit` | Edge enforces `fn_is_editor_or_admin`; commit is service-role only |
| **Schedule** | Set `publish_at`, status → `scheduled`; cancel → `cancelled` while still scheduled | User client update on `releases` (editor+) | Cron path uses **`run-jobs` → `publish`** as service role (no admin JWT) | RLS editor+ |
| **History** | List + detail: status badges (Draft / Scheduled / Publishing / Published / Failed / Cancelled); `published_at`, actor; prior `last_check` | Read-only queries | **None** | Staff select |
| **Failure reasons** | Failed release detail: render `last_check.failures[]` (code, severity, message, entity, entity_id) with same deep links as checklist | Read `releases.last_check` | Set by `publish` on check fail; pack-build fail path in `run-jobs` writes `PACK_BUILD_FAILED` into `last_check` | — |
| **Unpublish** | `/story/releases` or entity surfaces (grove/fragment/revision): confirm dialog; show **stranded-prerequisite warning** from response before/after? (A4) | Server action → **`unpublish`** edge with session JWT | **`unpublish`** → `fn_unpublish_commit` (returns `{ok, warnings[]}` with `STRANDED_PREREQ`) | Editor+ via edge; commit EXECUTE not for authenticated (F2) |
| **Preview (admin smoke)** | Optional “Preview manifest” on draft release detail for staff (integration is the bar; phone is M5). No mobile work | Call **`preview`** with session JWT | **`preview`** (**new** in M3d) | Staging signed URLs; never writes `public-media` |

**Shared client libs (not routes):** reuse `components/checklist-badges.tsx`, extend for revision/audio codes; release-item pickers; `lib/releases/links.ts` (entity → admin href); transcript form with **no** AI assist UI.

**Explicitly not M3d:** Listening Simulator, ambience/music authoring UI, Journal inbox, mobile preview mode (M5), Dashboard (M11).

---

## 3. Revision rules

| Rule | Source | Admin / DB behaviour |
|---|---|---|
| Day and/or Night versions | ADR 0004 §14; `revision_versions.time_window`; unique `(revision_id, language, time_window)` | Editor UI: add Day, Night, or both (≥1 required to publish — checklist `NO_VERSION`). English only for content now (ADR 0004 §26); keep `language` column default `en` |
| Narration asset picker | `narration_asset_id` → `audio_assets` | Pick from media library (kind preferably `narration`); reuse existing upload; one file may back Day and Night |
| Transcript | `transcript text not null`; AUDIO_SPEC / hard constraint | Staff **type** transcript; empty blocked by checklist `NO_TRANSCRIPT`. **No** AI suggest, TTS, auto-title, or auto-transcript anywhere |
| Optional `vtt` | Column exists | Optional field in M3d; not a checklist error if null |
| Story Contingency or Story Correction | ADR 0004 §13; `change_kind not null`; check `revision_no > 1 or change_kind = 'contingency'` | Required radios, **no default**. First revision of a fragment **must** be Contingency (DB check + UI). Contingency bumps `contingencyRevisionNo` in packs; Correction does not |
| Change note | `change_note` internal | Optional free text; **never** in packs (§12.4) |
| Writers draft; editors publish | DATA_MODEL §13; RLS on `fragment_revisions` | Writers create/edit `draft` / `in_review` only. Editors include revisions in a release and call `publish`. Writers: no Publish control; forced `publish` → 403 (already) |
| Immutability | DATA_MODEL §4 | Published revision rows are not edited; any change → new `revision_no` |
| Draft badges | M3c-review Accepted | Grove `fn_draft_check` must surface revision/audio issues for fragments in that grove via shared helpers (see §4) |

---

## 4. Migrations, RLS, grants and definer functions (and the 110 allowlist)

Schema for revisions/releases/snapshots/jobs already landed in **M3a**; publish/unpublish/schedule/go-live already work in SQL + edge. M3d is primarily **admin UI + `preview` + draft-check parity**.

| Proposed file | Purpose |
|---|---|
| `2026……_m3d_draft_check_revisions.sql` | Extend shared helpers + `fn_draft_check`: for each fragment in the grove, evaluate current/draft revisions with the **same** `NO_VERSION` / `NO_TRANSCRIPT` / `fn_check_audio_asset` paths used by `fn_publish_check` (M3c-review Accepted). Prefer extracting e.g. `fn_check_revision_local(revision)` so publish and draft share one body |
| `2026……_m3d_preview_grants.sql` (**only if needed**) | Any new authenticated-callable definer for preview projection; prefer implementing overlay in the edge function with service role after staff JWT check so `110` stays unchanged |
| RLS tweaks (**only if gaps found**) | Confirm writers cannot `UPDATE` revision `status` to `published`; confirm `in_review` workflow is in or out of M3d UI (A5). Releases already editor+ |

**`110_definer_grants.test.sql` (current allowlist on master tip):**

```
fn_admin_upsert_region(...)
fn_draft_check(p_grove_id uuid)
fn_publish_check(p_release_id uuid)
fn_require_editor_or_service()
fn_snapshot_projection_guarded(p_entity text, p_entity_id uuid)
fn_unreleased(p_grove_id uuid)
get_pack_index()
has_role(roles staff_role[])
```

- Keep helpers (`fn_check_issue`, `fn_check_audio_asset`, `fn_check_fragment_local`, new revision helper) **service_role only** (not authenticated), matching M3c.
- If a new authenticated definer appears, append its signature with a one-line why comment.
- Do **not** grant `fn_publish_commit` / `fn_unpublish_commit` / `fn_enqueue_due_releases` to authenticated.

**Edge:** add `supabase/functions/preview/` + `[functions.preview]` in `config.toml`; sync shared pack/snapshot zod via existing `db:sync-edge-shared` if preview reuses GrovePack types.

**No** edits to merged migrations.

---

## 5. Scheduled-release path (end to end) and failure reasons in the UI

```
Admin (editor+): release status=scheduled, publish_at set
        │
        ▼
pg_cron (every minute) → fn_enqueue_due_releases()
        │  for each due row: status → publishing; insert jobs(kind=publish_release, payload={release_id})
        ▼
pg_cron → pg_net → run-jobs (service role)
        │  processes publish_release first
        ▼
publish edge (service role):
        │  fn_publish_check → writes releases.last_check
        ├─ if !ok → status=failed, return 400 (nothing copied / committed)
        ├─ copy staging audio/images → public-media
        └─ fn_publish_commit → snapshots, revision statuses, enqueue rebuild_pack (tagged release_id)
        ▼
run-jobs rebuild_pack → build-pack → fn_release_go_live
        ├─ all builds success → live=true; release status=published; published_at set
        └─ rebuild exhausted retries → release status=failed; last_check includes PACK_BUILD_FAILED
```

**UI surfaces for reasons:**

| Failure mode | Where stored | Admin UI |
|---|---|---|
| Checklist fail at go-live (or dry-run) | `releases.last_check` from `fn_publish_check` | Failed / detail page: group by code; link entity |
| Pack build exhausted | `run-jobs` overwrites/sets `last_check` with `PACK_BUILD_FAILED` | Same renderer |
| Cancel before due | status `cancelled` | History; no job |

**Already covered by pgTAP/integration:** `052_scheduled_release.test.sql`; integration “scheduled release succeeds…” / “check failure marks release failed”. M3d adds **admin** schedule + failed-reason display + Playwright.

**Ambiguity to keep visible:** status-flow prose says `publishing` means “commit done, packs building”, but `fn_enqueue_due_releases` sets `publishing` **before** check/commit (see §9).

---

## 6. The `preview` edge function

| Topic | Plan |
|---|---|
| **Auth** | Require `Authorization` staff JWT (not service role for clients). Verify active staff via `has_role` / staff row (any active staff per TECH_SPEC “staff-only”; confirm viewer vs writer — A6). Refuse anon and non-staff with **401/403**. |
| **Input** | `{ releaseId }` — release must be `draft` (or draft/scheduled? A7). |
| **Manifest shape** | Per DATA_MODEL §12.5: **live grove pack(s) with the release’s changes overlaid** + **short-lived signed URLs** to staged assets. Propose zod `PreviewManifest` in shared (new) approximating GrovePack schema 2 fields the phone needs, plus `assets: [{ sha, ext, signedUrl, expiresAt }]`. Exact overlay algorithm (which groves, retired handling, multi-grove release) is **underspecified** — list in §9; implement only after architect picks a shape. |
| **Signed-URL expiry** | Spec says “short-lived” / “expire quickly” only. Propose **15 minutes** default (Supabase Storage `createSignedUrl`), return `expiresAt`; document in TECH_SPEC if accepted. Never copy to `public-media`; never list in `get_pack_index`. |
| **Side effects** | None on publish tables; no pack_builds row. |
| **Integration tests** | Add to `tools/pack-integration`: (1) anon/non-staff → refused; (2) staff JWT → 200, body has signed URLs with future expiry, overlay includes a draft revision asset sha from seed draft release; (3) URLs target `staging-*` not `public-media`. **No** Playwright phone. Optional admin button for manual smoke. |
| **config.toml** | `[functions.preview] verify_jwt = true` (match other staff functions). |

Phone persistence (`SQLite preview` table, discard on sign-out) is **M5**.

---

## 7. N3 (O(n) short-term loudness + Web Worker) — M3d or M4?

**Recommendation: move to M4** (or a tiny follow-up after M3d merges), not block M3d acceptance.

| Factor | Notes |
|---|---|
| Acceptance | M3d acceptance does **not** mention loudness performance; it already ships correct C2/C3 meters from M3c |
| Risk | Worker + transferable PCM touches upload UX and test harness; competes with the from-scratch Playwright publish path |
| Fit | M4 is sound-design / Listening Simulator — long beds and stems make O(n) + worker more valuable |
| If architect insists on M3d | Scope as optional polish: (1) segment-sum short-term in `loudness.ts`; (2) `analyzeAudioFile` in a Worker; unit tests only — no new acceptance item |

Carry text from M3c-review Verification: N3 deferred; this plan records the choice for approval.

---

## 8. Test plan ↔ M3d acceptance

| Acceptance item (M3-admin / BUILD_PLAN) | Unit (Vitest) | pgTAP | Integration | Playwright |
|---|---|---|---|---|
| **From-scratch grove → assets → fragments (physical, Day-only, cross-grove prereq) → revisions → release → checklist green → publish → `get_pack_index` + pack validates** | Pack zod / contingency helpers stay green | Existing publish/atomic tests; add only if new SQL | Optional assert index after publish if not redundant | **Required:** new `e2e/m3d-publish-from-scratch.spec.ts` — editor session, **no Maps key**, new grove (not seed), full path, assert index + GrovePack schema 2 |
| **Story Contingency changes `contingencyRevisionNo` in pack; Correction does not** | `contingency.ts` already | `042_contingency_revision_no` | Existing Farmington contingency integration | Include Contingency revision in from-scratch or a focused release publish assert |
| **Writer can’t publish (button absent + forced call refused)** | — | Writer denied on releases write / commit guards | Existing “writer cannot publish release” | Extend writer refusal: Releases Publish control absent; `POST publish` with writer session → 403 |
| **Scheduled release publishes on time; broken one fails with reason** | — | `052_scheduled_release` | Existing scheduled success + fail | Editor schedules soon / past-due; after job drain, UI shows published **or** failed + `last_check` codes visible |
| **`preview` refuses non-staff; expiring URLs for staff** | PreviewManifest zod | — | **Required** new cases (§6) | Optional admin-only smoke |
| **Every CI job green** | shared + admin | `db` job | integration + Playwright in `db` job | lint/typecheck/test `check` job |

**Also keep green (regression, not new M3d scope):** M3c grove authoring, off-spec warnings, C1 geometry re-save, writer Story Notes / marker 403, staged-edits pack isolation (`054`), atomic go-live (`053`).

**Draft-check parity:** pgTAP extending `067` — grove with draft revision missing transcript/version/audio warning codes matches `fn_publish_check` helpers for the same fragment when wrapped in a release.

---

## 9. Ambiguities and contradictions (list only — do not resolve)

1. **`publishing` meaning:** DATA_MODEL §8 status flow says `publishing` = “commit done, packs building”, but §10 / `fn_enqueue_due_releases` sets `publishing` **before** check and commit. Which is canonical for admin badges during the scheduled window?
2. **Preview manifest schema:** §12.5 is one sentence — full GrovePack overlay vs slim phone DTO; one grove vs all groves touched by the release; include region pack?
3. **Signed-URL TTL:** “short-lived” / “expire quickly” with no duration (propose 15 m — needs approval).
4. **Preview allowed release statuses:** draft only, or also scheduled / failed-retry drafts?
5. **Who may call `preview`:** any active staff (TECH_SPEC) vs editor+ only?
6. **Admin preview UI in M3d:** integration-only vs a button on the release page?
7. **Revision editor routing:** nested under grove fragment vs top-level `/story/revisions`?
8. **`in_review` status:** expose in M3d UI or keep writers on `draft` until release?
9. **Sound entity release items:** allow adding ambience/music/ui_cue ids by UUID without M4 UI, or hide until M4?
10. **Unpublish UX:** show stranded warning in a confirm step (dry-run) or only after commit in the response? No dry-run RPC exists today.
11. **Unpublish from Releases nav vs per-entity pages:** where is the primary entry?
12. **Cancel vs failed retry:** can a `failed` release return to `draft`/`scheduled` by editing, or only via a new release?
13. **Timezone for `publish_at`:** staff browser local, region timezone, or UTC-only display?
14. **`fn_publish_check` role gate:** still editor+ while `fn_draft_check` is all staff — should writers see release checklist read-only?
15. **VTT:** optional forever in M3d, or warn if missing?
16. **Day-only fragment in from-scratch E2E:** create Night-less revision only — confirm teaser need not mention night (ADR 0004 §11 hint language).
17. **BUILD_PLAN M3 accept** also lists off-spec loudness warnings and staged-edit isolation (done in M3c) — re-assert in M3d Playwright or treat as already satisfied?
18. **N3:** M3d vs M4 (this plan recommends M4 — confirm).
19. **First revision creation:** auto-create Contingency shell when a fragment is created in M3c, or only when writer opens revision editor in M3d?
20. **Transcript i18n:** `transcript` is plain `text` (not L10n jsonb) while titles/teasers are L10n — confirm one English transcript per version is enough.
21. **PACK_BUILD_FAILED** is not in DATA_MODEL §11 checklist table — should the admin treat it like checklist codes?
22. **Concurrent schedule:** two due releases same minute — order undefined; any admin promise?
23. **Marker codes in preview:** must remain absent from preview JSON (hash only), matching packs — confirm signed URLs never embed codes.
24. **English-only ADR §26 vs `revision_versions.language`:** hide language selector in M3d?
25. **Growth cue / sound warnings in draft check:** out of M3d authoring UI but may appear if seed links exist — show or filter?

---

## Explicit non-goals

- Implementing any of the above until this plan is approved
- Mobile preview mode, Chronicle, or pack sync (M5+)
- Listening Simulator / ambience / music UI (M4)
- Journal inbox (M9)
- Secrets, service role in admin, or Maps keys in CI

**Stop for architect review. Do not implement M3d until this plan is approved.**
