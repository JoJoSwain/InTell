# M3e story fields: architect review of the implementation

**Reviewed:** `docs/briefs/M3e-report.md` and `m3e-story-fields` at `90f6aa0` (PR #14), against the brief, `M3e-plan.md` and `M3e-plan-review.md`, including the screenshots
**Verdict:** **Approved after one required check (R1).** Fix or confirm on PR #14, then stop for verification.
**Reviewer:** architect (Claude), 2026-11-21

Clean, well-scoped work. All of these are right, and the tests are the ones asked for:
- G1: the opening is the first **published** root, retired ones are excluded, and the build fails rather than inventing one
- G2: `fn_l10n_blank` / `isL10nBlank` are used everywhere
- G3: context keys and deep links
- `grove_journeys` with split RLS and no `drive`
- `access_notes` gone, and stripped from old snapshots
- schema-3 zod, the index `opening`
- the contingency-then-correction `changeTeaser`
- staged journey edits
- the A15 transition, and the A18 contract test

---

## Required

### R1. A journey passage shows up doubled after saving
In `m3e-grove-journeys.png`, the **On foot** field reads *"E2E on foot to the opening root.E2E on foot to the opening root."* after save. The test passes anyway, because it checks `toHaveValue(/E2E on foot/)`, a regex that matches the doubled text too.

Find out whether the **stored** value is doubled or only the field's display. Possible causes: a form reset racing the redirect and `defaultValue`, or a second submit.
- **Tighten the test:** after Save, **reload the page**, assert the exact value (`toHaveValue("E2E on foot to the opening root.")`), and assert the stored `grove_journeys.passage.en` equals it exactly.
- **If it reproduces,** fix the cause. Apply the same exact-value checks to the change teaser and other-time hint fields, which use the same form pattern.
- **If it doesn't reproduce** after the reload, explain what produced the screenshot and replace it.

Writers will be typing real story text into these fields, so a save that silently doubles text isn't acceptable.

---

## Nit (fix if cheap)
- **N1. Preview errors on incomplete drafts.** `buildGrovePackObject` now throws for a character without a home grove or portrait. That's right for a published build, but a **preview** of a draft release with an incomplete linked character shows staff a generic failure. In `preview`, catch these build errors and return **422** with a plain message naming the character and the missing field, e.g. "River needs a home grove before preview." Add an integration case.

## Accepted
- The `webServer.env` typing follow-up (`37c05c9`)
- Characters with any status included in preview mode (they're drafts being previewed)
- The A17 README note

## Report back with
- The commits since `90f6aa0`
- R1: what caused the doubling, the fix if any, and the exact-value assertions after a reload
- N1, if done
- PR #14 CI and Vercel status on the new head

**Then stop for verification.** After M3e merges, the next brief is `docs/briefs/M3f-api-keys.md` (Supabase's new API keys; implement directly, then stop for review).

---

## Verification (Nov 21, tip `515267c`)

**Verified. PR #14 is ready to merge.** CI (`check`, `db`) and Vercel are green on `515267c`, and GitHub reports the branch mergeable with no conflicts.

- **R1: confirmed fixed.** The doubling was real and reached the database: a later save wrote the doubled text. `JourneyForm` now submits without a React form action, which skips React's automatic form reset, and then does a full page load. `saveGroveJourneys` returns instead of redirecting. The test uses unique values per run and asserts the exact text after save, after a reload, and in the stored `grove_journeys.passage.en`. Revision create gets the same exact checks, before and after a reload, for the change teaser and both other-time hints. The regenerated screenshot shows one passage.
- **N1: confirmed.** `preview` returns 422 with "<name> needs a home grove before preview." or "<name> needs a portrait before preview.", and an integration case covers it.

### Follow-ups (not blocking this merge)

- **F1. Check the other text forms for the same doubling. Required before writers enter real story content.** The report puts the cause down to "soft-nav form restoration", but that doesn't explain why only the journey form was hit. Many forms share its pattern: `<form action={serverAction}>`, textareas with `defaultValue`, and a redirect back to the same page. They are the grove, fragment, fragment Indigeny, character, region, notes, release and revision-edit forms. The M3c fragment-teaser test shows that a prefilled field survives one save. But the journey fields started empty, and no test does a second save without edits, which is the step that writes doubled text to the database. For each of those forms, add a Playwright "save twice" check:
  - fill one empty textarea and one prefilled one, then save
  - save again without editing
  - reload, then assert the exact values on screen and in the stored row

  Give any form that doubles the journey-form fix, as one shared helper rather than copies. For revision edit, the new remount key covers the teaser and hints but not the transcripts, so the sweep has to cover the transcripts.
- **F2 (nit).** `preview` finds incomplete characters by matching the error message against a regex. A typed build error carrying a code and the character name would hold up better. Do this the next time `buildGrovePack` changes (M4).

**Next:** merge PR #14, then `docs/briefs/M3f-api-keys.md`. F1 runs after M3f and the staging go-live, before writers start real content.
