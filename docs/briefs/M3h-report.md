# M3h report — form "save twice" sweep (M3e review F1)

**Branch:** `m3h-form-save-twice`  
**PR:** https://github.com/JoJoSwain/InTell/pull/17  
**Tip:** `3c183e8` (R2 ServerActionForm; prior R1 tip `b03e98f`)  
**Brief:** `docs/briefs/M3h-form-save-twice.md`  
**Review:** `docs/briefs/M3h-review.md` (Verification + R2)  
**Stop for verification.** No hosted DB push. No M3e F2, M3f K1–K3, M4, M5.

---

## 1. Form results

| Form | Doubled? | Fixed how |
|---|---|---|
| Region (`region-form.tsx` / `saveRegion`) | **No** | R2: `ServerActionForm` (aria-labels from earlier) |
| Character (`characters/[id]` / `saveCharacter`) | **No** | R2: `ServerActionForm` |
| Grove (`grove-form.tsx` / `saveGrove`) | **No** | R2: `ServerActionForm` |
| Fragment (`fragment-form.tsx` / `saveFragment`) | **No** | R2: `ServerActionForm` |
| Fragment Indigeny (`saveFragmentIndigeny`, writer) | **No** | R2: `ServerActionForm` |
| Story notes edit (`saveThread`) | **No** | R2: `ServerActionForm` |
| Story notes create (`saveThread`) | **No** | R2: `ServerActionForm` |
| Release details (`updateReleaseMeta`) | **No** | R2: `ServerActionForm` |
| Release create (`createRelease`) | **No** | Unchanged (create-only → new URL; allowlisted) |
| Revision edit (`updateRevision`: teaser, hints, transcripts) | **No** | R2: `ServerActionForm` |
| Journey passages (`journey-form.tsx`) | **No** | R2: moved onto shared `ServerActionForm` |

**Shared helper:** `ServerActionForm` (R2). Sweep stayed green after migration.

---

## 2. Root cause (revised after R1 + R2)

M3e’s journey doubling was real: after `<form action={saveGroveJourneys}>` plus soft `redirect` to the same grove URL, the On foot field showed the passage twice (`E2E on foot….E2E on foot….` in `m3e-grove-journeys.png`), and a later save wrote that concatenation into `grove_journeys`.

The signature seen twice (M3e screenshot and the R1 diagnostic) is **typed value followed by the prior stored value** — e.g. `MUT…-walk` + `M3h walk …` on screen and in STORED. That matches React 19’s automatic form reset after an `action` submit racing a same-URL soft re-render that restores `defaultValue`.

R1’s mutation check on **Next 15.5.29 / React 19.2.4** did not fail reliably with the pre-fix `action=` + `redirect` pair, so a sweep alone cannot prove the pattern safe. R2 removes the pattern: `ServerActionForm` submits via `onSubmit` + `startTransition` (no `action` prop → no automatic reset), then hard-navigates with `window.location.assign` to a busted `{ ok, href }` from the server action.

---

## 3. Helper API

See **R2** below (`ServerActionForm` / `ServerActionSubmit` / `saveHref`).

---

## 4. Suite results

| Check | Result |
|---|---|
| `pnpm db:setup-local` | **PASS** |
| `pnpm exec supabase test db` | **PASS** — Files=**36**, Tests=**198** |
| `pnpm test:integration` | **PASS** — **30** tests |
| Playwright (`apps/admin`) | **PASS** — **27** tests (11 M3h) |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** |
| `pnpm --filter @intell/admin build` | **PASS** |
| CI + Vercel on tip `5f44d40` | **PASS** (6/6) |
| CI + Vercel on tip `b03e98f` | **PASS** (6/6; empty re-trigger after sibling `db` race) |

---

## 5. Git log

```
b03e98f ci: re-trigger after sibling db race left seed release publishing
b7d2288 docs: record M3h Review fixes CI/Vercel green on 5f44d40
5f44d40 test(admin): R1 clickSave waits for next-action; M3h review fixes
fc3a186 docs: M3h review (R1: prove the sweep can catch the bug)
24588c1 docs: note M3h CI storage flake and re-trigger
9fd2178 ci: re-trigger after push-job storage flake on tip 8db0b71
8db0b71 docs: add M3h form save-twice report
4786ae5 test(admin): M3h save-twice sweep across all text forms
9028026 docs: M3h brief (form save-twice sweep, M3e review F1)
```

---

## 6. Changes shipped

- `apps/admin/e2e/m3h-save-twice.spec.ts` — save-twice + exact REST asserts for every form in the brief table; `clickSave` waits for `next-action` + stable fields
- `apps/admin/src/app/(shell)/regions/region-form.tsx` — aria-labels (`Region name`, `Region slug`, `Timezone`, `Bounds GeoJSON`)

---

## 7. Review fixes (`M3h-review.md` R1)

### Mutation check (not committed)

Temporarily restored `JourneyForm` / `saveGroveJourneys` from `90f6aa0` (`<form action={saveGroveJourneys}>` + `redirect(\`/story/groves/${groveId}\`)`). Drove the journey case with the **same generic `clickSave` / `saveTwice`** as the other forms (no `?journeys=` URL wait).

**Result on current stack:** the exact-value asserts **passed** (mutation did **not** fail). Example: journey passages green in ~10s with prior walk prefilled and bike/transit empty.  

**Earlier same-session diagnostic** (pre-fix form, prior walk still in DB; no exact assert — logging only):

```
AFTER_FIRST_SAVE_WALK= "MUT1795332567119-walkM3h walk 1795332204361"
EXPECTED= "MUT1795332567119-walk"
AFTER_SECOND_SAVE_WALK= "MUT1795332567119-walkM3h walk 1795332204361"
STORED= "MUT1795332567119-walkM3h walk 1795332204361"
```

That concat was not reproducible on clean re-runs after `clickSave` was fixed. Pre-fix sources were restored; nothing from the mutation was committed.

### `clickSave` change

- Arm `page.waitForResponse` for the POST whose request headers include `next-action` **before** the click.
- After the response: wait until editable field values are unchanged for ~500ms (`waitForStableFields`). Do not use `networkidle`.
- If the submit button disables (JourneyForm `useTransition` pending), also race a URL change for hard-nav forms, then re-hydrate and wait for stable fields.
- Journey uses this same helper for both saves.

### Re-run per form (fixed helper)

All **11** M3h cases passed again; **none doubled**. No shared helper applied.

### Revised root-cause paragraph

See §2 above.

### PR #17 CI / Vercel

**Green** on functional tip `5f44d40` and tip `b03e98f` (6/6 each: GitHub Actions `check` + `db`, Vercel deploy). Docs tip `b7d2288` hit the known dual-workflow race (one `db` left the seed release `publishing`); empty commit `b03e98f` re-triggered clean. Verification tip `2f216a9` also green (6/6).

---

## R2. Shared `ServerActionForm` (Verification)

### Helper API

`apps/admin/src/components/server-action-form.tsx`:

- **`ServerActionForm`** — client form with `onSubmit` + `preventDefault` + `FormData` + `startTransition`. No React `action` prop. Shows errors (`role="alert"`). Submit disabled until mount and while pending. On success: `window.location.assign(result.href)`.
- **`ServerActionSubmit`** — submit button that reads pending/mounted from context (`variant` / `size` optional).
- **`saveHref(path)`** (`server-action-result.ts`) — appends `?_=` / `&_=` so every successful save changes the URL (real load + remount).
- Actions return `{ ok: true, href }` instead of `redirect()` after save; `/sign-in` and `/no-access` redirects kept.

### Converted forms

| Form | Notes |
|---|---|
| Journey (`journey-form.tsx`) | Moved onto shared helper |
| Region (`region-form.tsx`) | create + update |
| Grove (`grove-form.tsx`) | create + update |
| Fragment (`fragment-form.tsx`) | `saveFragment` + Indigeny |
| Character list + detail | create + update |
| Story notes | edit + create |
| Release details | `updateReleaseMeta` |
| Revision create + edit | shared form/action |
| Image / audio asset edit | text fields, same-page return |
| Staff row edit | display name |

**Left as `<form action={…}>` (exceptions):**

- Button-only: rotate marker, remove/add release item, retry/cancel/copy, deactivate/reactivate staff, delete draft revision, schedule (datetime-local only).
- Create-only to a **new** URL: `createRelease` (`releases/new`) — allowlisted in the static guard.
- Staff invite already uses client `onSubmit` (not `action=`).

### Guard

- **AGENTS.md** §6 Admin: text-editing forms use `ServerActionForm`; no `<form action={…}>` with text fields that redirects back to the same page.
- **Static test** `apps/admin/src/lib/server-action-form-guard.test.ts`: fails when a `<form action={…}>` contains a `textarea` or text `input`, with allowlist for `releases/new/page.tsx`.
- Shell sets `html[data-js-ready=1]` on mount; e2e waits via `waitForClientReady` after hard-nav.

### Suite results (R2)

| Check | Result |
|---|---|
| `pnpm db:setup-local` | **PASS** |
| `pnpm exec supabase test db` | **PASS** — Files=**36**, Tests=**198** |
| `pnpm test:integration` | **PASS** — **30** tests |
| Playwright (`apps/admin`) | **PASS** — **27** / 27 (11 M3h) |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** |
| `pnpm --filter @intell/admin build` | **PASS** |
| M3h sweep | **PASS** — none doubled |

### PR #17 CI / Vercel (R2 tip)

Tip `3c183e8` pushed; waiting on CI/Vercel green (stop for verification).
