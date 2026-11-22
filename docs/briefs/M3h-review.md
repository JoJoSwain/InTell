# M3h review: form "save twice" sweep

**PR:** #17 · **Tip reviewed:** `24588c1` (spec `4786ae5`) · **Brief:** `docs/briefs/M3h-form-save-twice.md`

## Verdict

**One required change (R1): prove the sweep can catch the bug.** The coverage is right: every form in the brief is included, assertions are exact, values are checked in the stored rows, and nothing is a regex. But the save helper probably doesn't wait for the first save to finish before clicking Save again, on the forms that redirect back to the **same URL**. If so, the test passes whether or not the bug exists.

## R1. The second save may fire before the first save's re-render

On the redirect path, `clickSave` does this:

```ts
await Promise.race([
  page.waitForURL((url) => url.toString() !== urlBefore, …),
  page.waitForLoadState("networkidle"),
])
```

- For grove, fragment, Indigeny, character, region and release details, the redirect goes back to the **same URL**, so `waitForURL` never fires.
- `waitForLoadState("networkidle")` **resolves immediately** when the current document has already reached that state, which is Playwright's documented behaviour. A soft navigation doesn't reset it.
- These forms have no pending state on their submit button, so the `toBeDisabled` branch doesn't apply either.

So the second click most likely lands while the first server action is still in flight. React captures that FormData at click time, which is still the typed value. The doubling in M3e appeared **after** the post-save re-render, and the damage came from the save **after** that. This test never does that save. `expectExact` straight after `saveTwice` can also pass before the re-render arrives.

**The report's root-cause paragraph contradicts its own results.** It suggests "empty fields plus soft restore". But grove Premise, character notes and fragment Teaser all **started empty** in this sweep and passed. Either that hypothesis is wrong, or the test isn't exercising the path. The check below tells us which.

### Required
1. **Mutation check (record it in the report; don't commit the revert).** Temporarily restore the pre-fix `JourneyForm` and `saveGroveJourneys` from `90f6aa0` (`<form action={saveGroveJourneys}>` plus `redirect`). Run a journey case that uses the **same generic `clickSave`** the other forms use, not the `?journeys=` URL wait. It **must fail** on doubled text, on screen or in the stored row. If it passes, the helper is blind to the bug: fix step 2 and repeat until it fails.
2. **Make `clickSave` wait for the save to really finish:**
   - Wait for the server-action POST response. It's the request carrying the `next-action` header: set up `page.waitForResponse` **before** the click.
   - Then wait for the page to re-render. Don't rely on `networkidle`. Poll until the field values have been stable for about 500 ms, or wait for an explicit marker.
   - Only then assert, or click Save again.
3. **Re-run the whole sweep with the fixed helper.** If any form now doubles, apply the brief's fix: one shared helper for all affected forms, never copies.
4. **Rewrite the root-cause paragraph** from what the mutation check and the re-run show.

## Accepted
- The aria-labels on `region-form.tsx`, which are needed for the labels the test finds fields by.
- The CI storage-flake re-trigger.

## Report back with
- The mutation-check result: the failing output with the pre-fix code, in a short excerpt.
- The `clickSave` change.
- Re-run results per form, with fixes if any.
- The revised root-cause paragraph.
- PR #17 CI and Vercel status on the new head.

**Then stop for verification.**
