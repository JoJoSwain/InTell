# M3h report — form "save twice" sweep (M3e review F1)

**Branch:** `m3h-form-save-twice`  
**PR:** https://github.com/JoJoSwain/InTell/pull/17  
**Tip:** `5f44d40` (Review fixes + `clickSave`; review `fc3a186`)  
**Brief:** `docs/briefs/M3h-form-save-twice.md`  
**Review:** `docs/briefs/M3h-review.md` (`fc3a186`)  
**Stop for verification.** No hosted DB push. No M3e F2, M3f K1–K3, M4, M5.

---

## 1. Form results

| Form | Doubled? | Fixed how |
|---|---|---|
| Region (`region-form.tsx` / `saveRegion`) | **No** | Unchanged (aria-labels only for e2e) |
| Character (`characters/[id]` / `saveCharacter`) | **No** | Unchanged |
| Grove (`grove-form.tsx` / `saveGrove`) | **No** | Unchanged |
| Fragment (`fragment-form.tsx` / `saveFragment`) | **No** | Unchanged |
| Fragment Indigeny (`saveFragmentIndigeny`, writer) | **No** | Unchanged |
| Story notes edit (`saveThread`) | **No** | Unchanged |
| Story notes create (`saveThread`) | **No** | Unchanged (one save + exact REST checks) |
| Release details (`updateReleaseMeta`) | **No** | Unchanged |
| Release create (`createRelease`) | **No** | Unchanged (one save + exact checks) |
| Revision edit (`updateRevision`: teaser, hints, transcripts) | **No** | Unchanged |
| Journey passages (`journey-form.tsx`) | **No** (already fixed in M3e) | Unchanged; included in sweep (second save without edits) |

**Shared helper:** none. No form failed the double-save check (including after the R1 `clickSave` fix), so per the brief no `ServerActionForm` / `useHardNavSubmit` was extracted.

---

## 2. Root cause (revised after R1)

M3e’s journey doubling was real: after `<form action={saveGroveJourneys}>` plus soft `redirect` to the same grove URL, the On foot field showed the passage twice (`E2E on foot….E2E on foot….` in `m3e-grove-journeys.png`), and a later save wrote that concatenation into `grove_journeys`. The durable fix remains hard navigation (`window.location.assign(?journeys=…)`) with a remount key and a non-redirecting action.  

Under this review’s mutation check on **Next 15.5.29 / React 19.2.4**, restoring that pre-fix `action=` + `redirect` pair (not committed) and driving it with the fixed generic `clickSave` did **not** leave doubled text on screen or in REST after save → save-again — even with a known prior walk value, empty bike/transit, `next dev` and `next start`, and with or without the page `key={journeyRemountKey}`. One mid-session diagnostic (after a malformed `supabaseUrl` in `.env.local` had just been fixed) did print a stuck concat once (`MUT…-walk` + prior `M3h walk …` on screen and in STORED); clean re-runs never repeated it. So the original failure mode is soft-nav restoration of an uncontrolled `defaultValue` against a still-typed DOM value, but it is no longer reliably sticky on this stack when the save is allowed to finish before the second click. The earlier report’s “empty fields plus soft restore” hypothesis is withdrawn: grove Premise, character notes and fragment Teaser all started empty in the sweep and never doubled.

---

## 3. Helper API

Not added.

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
| CI + Vercel on tip `5f44d40` | **PASS** (6/6 checks green) |

---

## 5. Git log

```
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

**Green** on tip `5f44d40` — all 6 CI checks completed without failures (GitHub Actions `check` + `db`, Vercel Preview Comments / deploy).
