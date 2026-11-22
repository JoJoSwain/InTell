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


---

## Verification (Nov 22, tip `2067270`)

**R1 is done. The result calls for one more change, R2, before merge.**

**Checked:**
- `clickSave` now arms `waitForResponse` for the `next-action` POST before the click.
- It then waits for the field values to stay stable for about 500 ms, instead of relying on `networkidle`.
- The journey case uses the same generic helper.
- The M3c Teaser locator fix (role plus exact name) is fine.
- CI and Vercel are green on `b03e98f` and `2067270`. The one cancelled run was a duplicate `pull_request` run superseded by concurrency.

**What the mutation check showed.** It **did not fail reliably.** With the pre-fix `JourneyForm` restored, clean re-runs passed. But one diagnostic run reproduced the bug, on screen **and in the stored row**:

`AFTER_FIRST_SAVE_WALK = "MUT…-walk" + "M3h walk …"` (the typed value followed by the **previous** value), `STORED` = the same concatenation.

That is the same signature as M3e's screenshot, where the typed value came first and the prior stored value followed. So the failure is real but **intermittent**. The forms that share the pre-fix pattern (`<form action={serverAction}>` + uncontrolled fields + redirect back to the same URL) can't be proven safe by a sweep that only fails sometimes. The common factor is React 19's automatic form reset after an `action` submit, racing the same-URL re-render that updates `defaultValue`.

## R2. Take the risky pattern out of every text-editing form

Writers will type real story text into these forms, and a silent concatenation is the worst kind of data loss. So remove the pattern rather than wait for it to show up:

1. **One shared client component**, e.g. `apps/admin/src/components/server-action-form.tsx` (`ServerActionForm`):
   - It submits through `onSubmit` with `preventDefault`, `FormData` and `startTransition`. There is no `action` prop, so React's automatic form reset never runs.
   - It shows action errors (`role="alert"`) and disables its submit button while pending.
   - On success it does a **full page load** (`window.location.assign`) to the `href` the action returns.
   - Move `JourneyForm` onto it.
2. **Change the server actions behind these forms to return `{ ok: true, href }`** instead of calling `redirect()` after a successful save. Keep the `/sign-in` and `/no-access` redirects. That covers create and update in one path, for example `saveRegion`, `saveGrove` and `saveCharacter`.
3. **Convert every form that edits text and comes back to the same page.** At minimum that's region, character, grove, fragment, fragment Indigeny, story notes (edit), release details (`updateReleaseMeta`) and revision edit (`updateRevision`). Grep for the rest and list every converted form in the report.
   - Button-only forms with no text fields, like remove item, retry or rotate marker code, can stay as they are.
   - So can create-only forms that go to a **new** URL, like release create and revision create. Convert them too if they share an action with an update path.
4. **Guard against the pattern coming back:**
   - Add a rule to AGENTS.md: *admin forms that edit text use `ServerActionForm`; no `<form action={…}>` with text fields that redirects back to the same page*.
   - Add a small static check in the admin tests **if it's cheap**: it fails when a `<form action={…}>` contains a `textarea` or a text `input`, with an explicit allowlist for create-only forms.
5. **Keep the M3h sweep green.** It now exercises the helper on every converted form.
6. **Root-cause paragraph:** add the "typed value followed by prior value" signature, seen twice, and what the helper removes.

**Report back with:** the helper's API; the converted-form list with any exceptions and why; the guard; the suite results; and PR #17 CI and Vercel status. **Then stop for verification.**
---

## Verification of R2 (Nov 22, tip `333c41b`; merged as `dbc9412`)

**Verified. M3h is complete.** CI and Vercel were green on `333c41b`.

- **`ServerActionForm` and `ServerActionSubmit`** submit through `onSubmit` plus `startTransition`, with no `action` prop, so React's automatic form reset never runs. The submit button is disabled until the form mounts and while it saves. Errors show in the form. On success, `window.location.assign` goes to the action's `{ ok: true, href }`, and `saveHref` adds a cache-busting query.
- **Converted:** region, character (both forms), grove, fragment, fragment Indigeny, story notes (create and edit), release details, revision edit and journey passages. Also audio details, image details and the staff row actions. The only exception is release create, which is create-only and goes to a new URL, and it's on the allowlist.
- **Guard:** `server-action-form-guard.test.ts` fails on any `<form action={…}>` that contains a text field outside the allowlist. AGENTS.md carries the rule.
- **The M3h sweep** stays green on the helper path.

**Follow-ups, carried into Lane A's first M4 batch:**
- **V1. Only same-site redirects.** `ServerActionForm` should accept only a same-origin relative `href`: it starts with `/` and not `//`. Reuse `sanitizeNext`.
- **V2. Readable errors.** Next.js hides thrown server-action messages in production. Expected failures, such as validation or a duplicate slug, should come back as `{ ok: false, error }` and be shown as-is, so writers see something useful instead of a generic message.
