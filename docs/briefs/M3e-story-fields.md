# Brief: M3e, story fields from ADR 0005

**Branch:** `m3e-story-fields`, cut from `origin/master` after the M3d PR (which carries the ADR 0005 docs commit) merges.
**Authority:** ADR 0005 → DATA_MODEL v3 (as amended for ADR 0005) → this brief. ADR 0004 and the M3 brief still apply where not amended.
**Size:** small. One PR. Write `docs/briefs/M3e-plan.md` first and **stop for architect review** (see "Plan checkpoint").

## Goal
Give writers and editors the authoring fields ADR 0005 needs **before real characters and groves are built on staging**, and ship them to phones in GrovePack **schema 3**. The phone-side features (Embark, the pulsing marker, Chronicle cards and hints) come later, in M5 and M8.

## Preconditions (check these first; stop and report if any fails)
- `master` contains the M3d merge and the ADR 0005 docs commit (`docs/adr/0005-listener-experience.md` exists).
- `pnpm db:setup-local`, `pnpm exec supabase test db`, `pnpm test:integration`, Playwright and `pnpm lint && pnpm typecheck && pnpm test` are green on master.

## Decisions already made (don't revisit)
1. **Character home grove:** `characters.home_grove_id uuid references groves(id)`. Writers set it. It's **required to release** a character (`NO_HOME_GROVE`), and the home grove must be published or in the same release (`DEPENDENCY_UNPUBLISHED`).
2. **Portrait required to release a character** (`NO_PORTRAIT`). The admin label for `public_intro` becomes **"Back story"**, with no schema rename.
3. **Change teaser:** `fragment_revisions.change_teaser jsonb not null default '{}'` (L10n, public).
   - Required for every contingency revision after revision 1 (`NO_CHANGE_TEASER`).
   - Editable only while the revision is a draft. The M3d D1 immutability trigger already guards published revisions.
   - In the pack, a fragment's current revision carries `changeTeaser` taken from **the revision whose `revision_no` = `contingencyRevisionNo`**, even when corrections followed it. It's omitted when `contingencyRevisionNo` = 1.
4. **Other-time hint:** `revision_versions.other_time_hint jsonb not null default '{}'` (L10n, public). It's the Chronicle line that advertises *this* version to a listener who has heard only the other time window. Required on **both** versions when a revision has both a Day and a Night version (`NO_TIME_HINT`).
5. **Journey passages:**
   - new enum `journey_mode as enum ('walk','bike','transit')`, with **no driving value, by design**
   - new table `grove_journeys (grove_id, mode, passage L10n, …ts, primary key (grove_id, mode))`
   - optional: a missing passage never blocks anything
   - writer+ may insert, update and delete; all staff may read. Use **split policies**, so the B1 for-all guard stays green
   - part of the grove's snapshot projection, so edits are staged until a release
6. **Remove `groves.access_notes`** everywhere: column, projection, pack, zod, admin form, seed, fixtures, tests and copy. No car, parking or arrival-logistics fields replace it (ADR 0005 §6).
7. **Opening root:** a grove's first `root` fragment by `story_order`, then `id`, among published, non-retired fragments. There's no new column. Two new outputs:
   - `GrovePack.grove.openingFragmentId`
   - an `opening: {lat, lng}` field on grove rows of `get_pack_index()`. Suggested: `build-pack` records it on the grove's `pack_builds` row, and the index reads it.
   - `NO_ROOT` (error) if a grove has no root fragment.
8. **GrovePack schema 3** per DATA_MODEL §12.1: `accessNotes` removed; `grove.openingFragmentId`; `grove.journeys {walk?, bike?, transit?}`; characters gain `homeGroveId` (and `portraitSha`/`portraitAlt` become required); revisions gain `changeTeaser?`; versions gain `otherTimeHint?`. `PreviewManifest` carries schema-3 grove packs. Bump the schema number and update the zod, canonical-JSON, drift-check and pack tests.
9. **Checklist codes go through the shared helpers** (`fn_check_*`) and appear in **both** `fn_publish_check` and `fn_draft_check`, with a parity test, as in M3c and M3d.
10. **New migrations only.** Never edit merged migrations.

## Scope
1. **Migrations:** the enum, `grove_journeys` (with `updated_at` trigger and RLS), the three new columns, dropping `access_notes`, the projection updates, the checklist helpers, `build-pack`/index changes for the opening point, and `110` allowlist updates only if a new authenticated definer appears.
2. **Admin:**
   - **Character page:** a home-grove picker; the portrait marked as required to release; "Back story" label.
   - **Revision editor:**
     - a **Change teaser** field, shown and required for a contingency after revision 1, with the hint "Shown to listeners when they tap a fragment whose story has changed."
     - an **Other-time hint** field per version, shown when both Day and Night exist, with a short example in the field's help text
   - **Grove editor:** remove access notes; add a **Journey passages** section with three optional fields, **On foot**, **By bike** and **By transit**, and the help text "Shown in Embark after a listener picks how to travel. Link this way of arriving to the grove's opening root."
   - **Checklist badges** render the new codes and deep-link to the field that fixes each one.
3. **Seed and fixtures:**
   - each seed character gets a home grove and a portrait
   - contingency revisions after revision 1 get a change teaser
   - two-version revisions get both hints
   - the seed grove gets journey passages for all three modes, as plainly labelled placeholder test text
   - `access_notes` removed
4. **Shared:** the zod `GrovePack` schema 3, the pack fixtures, and the forbidden-fields test updated (no `accessNotes`; still no marker codes or Story Notes).

## Out of scope
The `embark` relay, the Routes API key and any mobile code (M5); the Chronicle UI (M8); the pulsing marker (M5); `embark_usage` (M5).

## Hard constraints most at risk
- **No cars.** `journey_mode` has exactly `walk`, `bike` and `transit`. No `drive` value, option, label, copy or placeholder anywhere.
- **No AI generation.** Passages, teasers and hints are typed by staff. No suggestions.
- **Staged edits.** Journey passages, home grove, portrait and hints reach packs only through a release. Test that editing a published grove's journey passage changes nothing in its pack until it's released.
- **Packs carry no Story Notes and no marker codes.** The new public fields are the only additions.
- **Hiding UI is not security.** A viewer can't write `grove_journeys` (pgTAP). A writer can (pgTAP and Playwright).

## Acceptance
- [ ] pgTAP:
  - each new code fires and clears, with `fn_publish_check` and `fn_draft_check` agreeing
  - `grove_journeys` RLS works (viewer refused; writer allowed)
  - the B1 for-all guard stays green
  - no `drive` value exists in `journey_mode`
  - `access_notes` is gone
- [ ] Integration: publishing a grove produces a **schema 3** pack with `openingFragmentId`, `journeys` and character `homeGroveId`. `get_pack_index` returns the grove's `opening` point. A contingency followed by a correction still carries the contingency's `changeTeaser`. Editing a published grove's passage doesn't change its pack until released.
- [ ] Playwright:
  - a writer fills in journey passages, a character's home grove, a change teaser and both other-time hints
  - a release missing any required field fails with the matching code and a deep link
- [ ] The Farmington seed builds a valid schema-3 pack.
- [ ] Every CI job is green.

## Plan checkpoint
Write `docs/briefs/M3e-plan.md` covering:
- the precondition results
- the migration list in order
- the projection, `build-pack` and index changes, including where the opening point is stored
- the zod schema-3 diff
- the admin changes
- the test plan mapped to the acceptance items
- **every ambiguity you find**

Then stop for architect review.

## Report back with
`git log --oneline`; results of db reset, pgTAP, integration, Playwright and the root checks; the schema-3 zod diff; doc amendments, quoted; deviations; open questions.
