# M3h brief: form "save twice" sweep (M3e review F1)

**Branch:** `m3h-form-save-twice` (already created locally from master `da396dd`, with this brief committed). **Implement directly**, open a PR, then stop for architect review. Writers will start entering real story text in the admin soon, and this must land first.

## Why

In M3e (R1), the grove **journey form** showed its text doubled after save. A later save then wrote the doubled text to the database. Cursor fixed that one form: it now submits through `onSubmit` plus `startTransition` and does a full page load afterwards. But the cause was never pinned down. "Soft-nav form restoration" doesn't explain why only that form was hit.

The same pattern is used across the admin: `<form action={serverAction}>`, fields with `defaultValue`, and a redirect back to the same page. The M3c fragment-teaser test proves one save works on a prefilled field. **No test saves twice without edits**, and that second save is the step that writes doubled text.

## Forms in scope

| Form | File | Action |
|---|---|---|
| Region | `regions/region-form.tsx` | `saveRegion` |
| Character | `story/characters/[id]/page.tsx` | `saveCharacter` |
| Grove | `story/groves/grove-form.tsx` | `saveGrove` |
| Fragment | `story/groves/fragment-form.tsx` | `saveFragment` |
| Fragment Indigeny | `story/groves/fragment-form.tsx` | `saveFragmentIndigeny` |
| Story notes (threads), create and edit | `story/notes/page.tsx` | `saveThread` |
| Release details | `story/releases/[id]/page.tsx` | `updateReleaseMeta` |
| Release create | `story/releases/new/page.tsx` | `createRelease` (redirects to a new URL: one save plus exact checks is enough) |
| Revision edit (draft) | `…/revisions/revision-form.tsx` | `updateRevision`: cover the **transcripts** as well as the teaser and hints |
| Journey passages | `story/groves/journey-form.tsx` | already fixed: include it in the sweep anyway (second save without edits) |

## The check (new spec `apps/admin/e2e/m3h-save-twice.spec.ts`)

For each form:
1. Use one textarea that **starts empty**, one textarea that **starts prefilled**, and one single-line text input. Prefill through the seed or a service-key REST call in setup.
2. Fill them with unique values (stamp them with `Date.now()`), save, and assert the **exact** values on screen.
3. **Save again without editing anything.**
4. Reload. Assert the exact values on screen, and assert the **stored** values exactly, using the L10n `.en` where the column is L10n. Read them through REST with the service key, as `m3e-story-fields.spec.ts` does.

Never use regex or "contains" assertions for field values.

## If a form doubles

- **Don't copy the JourneyForm code into each form.** Extract **one shared client helper**: a `ServerActionForm` component or a `useHardNavSubmit` hook. It submits through `onSubmit` plus `startTransition`, shows action errors, disables the submit button while pending, and does a full page load to a given URL afterwards.
- Move `JourneyForm` onto the helper, apply it to every form that failed, and have the server actions return instead of redirecting where needed.
- If none of the other forms double, say so in the report and leave them unchanged.

## Root cause

Write one paragraph, with evidence, on why the journey form doubled. One candidate: it was the only form whose fields started **empty** before the first save. If you can't settle it, list what you ruled out.

## Out of scope
M3e F2, M3f K1–K3, M4, M5. No migrations are expected. If one seems necessary, stop and ask.

## Acceptance
- [ ] The new spec covers every form in the table and passes, after any fixes.
- [ ] The full local suite is green: pgTAP, integration, Playwright, lint, typecheck, test and build. CI and Vercel are green.

## Report back with
Write `docs/briefs/M3h-report.md` covering:
- a table of each form: doubled or not, and fixed how
- the root-cause paragraph
- the helper's API, if one was added
- the suite results and `git log --oneline`

**Then stop for architect review.** Nothing hosted is needed after the merge: Vercel deploys the admin automatically.
