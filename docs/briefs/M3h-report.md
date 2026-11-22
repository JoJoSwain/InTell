# M3h report — form "save twice" sweep (M3e review F1)

**Branch:** `m3h-form-save-twice`  
**PR:** https://github.com/JoJoSwain/InTell/pull/17  
**Tip:** `4786ae5` (brief `9028026`)  
**Brief:** `docs/briefs/M3h-form-save-twice.md`  
**Stop for architect review.** No hosted DB push. No M3e F2, M3f K1–K3, M4, M5.

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

**Shared helper:** none. No form failed the double-save check, so per the brief no `ServerActionForm` / `useHardNavSubmit` was extracted.

---

## 2. Root cause (journey doubling in M3e)

The journey form was the only in-scope form that used empty textareas on first listen *and* a soft `redirect` back to the same page after `action={…}`. Soft navigation restored the uncontrolled `defaultValue` fields in a way that concatenated the prior typed value into the next submit (evidence from M3e R1 and the JourneyForm comments: hard `window.location.assign` after `startTransition` + a non-redirecting action stopped the doubling). Other forms either started with seed-prefilled text, remounted via keys, or completed a redirect fast enough that the same empty-field + soft-restore path did not reproduce under this sweep. Ruled out as a general “every `action={serverAction}` form doubles” bug: character, grove, fragment, notes, release, and revision all passed fill → save → save-again → reload + REST exact asserts.

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
| Playwright (`apps/admin`) | **PASS** — **27** tests (11 new M3h) |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** |
| `pnpm --filter @intell/admin build` | **PASS** |
| CI (6/6) + Vercel on tip `4786ae5` | **PASS** |
| CI + Vercel on tip including report | Re-triggered after push-job storage flake on `8db0b71` (PR sibling `db` succeeded) |

---

## 5. Git log

```
4786ae5 test(admin): M3h save-twice sweep across all text forms
9028026 docs: M3h brief (form save-twice sweep, M3e review F1)
```

---

## 6. Changes shipped

- `apps/admin/e2e/m3h-save-twice.spec.ts` — save-twice + exact REST asserts for every form in the brief table
- `apps/admin/src/app/(shell)/regions/region-form.tsx` — aria-labels (`Region name`, `Region slug`, `Timezone`, `Bounds GeoJSON`)
