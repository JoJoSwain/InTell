# M3d revisions, releases and preview: architect review of the plan

**Plan reviewed:** `docs/briefs/M3d-plan.md` (`6dba209`, branch `m3d-releases`)
**Verdict:** **APPROVED with the additions and answers below.** Implement M3d on `m3d-releases`. Where this review conflicts with the plan or the brief, this review wins.
**Reviewer:** architect (Claude), 2026-11-20

A clear plan. The end-to-end scheduled-release trace in §5 and the ambiguity list are especially useful. Addition D1 closes a hard-constraint gap that exists on master today.

---

## Additions (required)

### D1. Published revisions must be immutable in the database
Packs read **current revisions directly**; revisions aren't snapshotted (DATA_MODEL §8). But RLS lets editors update or delete **any** revision, including published ones, and `revision_versions` is writer+ `for all` regardless of the parent's status. Today, an editor fixing a typo in a published transcript, or anyone with write access swapping the narration on a published version, would reach phones at the next rebuild of that grove **without a release**. That breaks the hard constraint "Staged edits must not reach phones" and DATA_MODEL §4 ("any change → new `revision_no`").

**Fix (new migration):**
- **`fragment_revisions`:** a `BEFORE UPDATE OR DELETE` trigger. When `auth.role() = 'authenticated'` and `old.status <> 'draft'`, refuse with 42501. Edits to non-draft revisions happen only by creating a new revision. The publish and unpublish commits run as the service role, and migrations, seeds and the SQL editor have no API role, so all of those pass through.
- **`revision_versions`:** a `BEFORE INSERT OR UPDATE OR DELETE` trigger with the same rule, keyed on the parent revision's status.
- **pgTAP:**
  - an editor can't edit or delete a published revision or its versions
  - a writer can't add a version to a published revision
  - drafts stay fully editable
  - the publish commit still moves statuses
- **Integration:** editing a published revision's working data is refused, and the pack is unchanged.

### D2. The database assigns revision numbers
Don't compute `max + 1` in the app; that's racy under RLS. Add a `BEFORE INSERT` trigger on `fragment_revisions` that:
- locks the parent fragment row (`select … for update`)
- sets `revision_no = coalesce(max, 0) + 1`
- relies on the existing check that revision 1 is a contingency

The form never sends `revision_no`. pgTAP covers sequential numbering and the first-revision rule.

### D3. Preview reuses the pack assembler: one assembler, two sources
No second pack builder. Refactor `build-pack`'s assembly into a pure function that takes a **source**:
- **Published source:** `published_snapshots` plus current published revisions. This is what `build-pack` uses today.
- **Preview source:** the published source, plus the release's items overlaid. Entities in the release use their working-row projection (`fn_snapshot_projection`), and revisions in the release become the current revision for their fragments.

`preview` runs the assembler with the preview source for **every grove the release touches**: groves in the items, groves of fragments or revisions in the items, and groves whose `externalPrerequisites` change. It returns:

```
PreviewManifest {
  schema: "preview/1",
  releaseId,
  generatedAt,
  expiresAt,
  groves: GrovePack[],   // schema 2, validated by the same zod
  assets: [{ sha, ext, url, expiresAt }]
}
```

- Staged shas get signed URLs.
- Already-public shas get their normal public URL.
- No region pack is included.
- The output contains no marker codes (hash only, same projection) and no Story Notes. Add a test for both.

### D4. Unpublish shows its warning before it commits
Factor the stranded-prerequisite logic out of `fn_unpublish_commit` into a shared helper, for example `fn_stranded_prereqs(entity, ids[])`.
- Expose a read-only `fn_unpublish_preview(entity, ids[])`, editor+ guarded; if it's a definer, add a `110` line.
- The confirm dialog shows the stranded fragments **before** the editor confirms.
- The commit returns the same warnings, computed by the same helper.

pgTAP: preview and commit agree for the same input.

---

## Answers to §9

| # | Decision |
|---|---|
| 1 | **`publishing` means "go-live in progress":** the check, copy, commit and pack builds. Amend DATA_MODEL §8's status-flow line to match what `fn_enqueue_due_releases` does. The badge reads "Publishing…". |
| 2 | See **D3**. |
| 3 | **1 hour** signed-URL TTL. The phone downloads at fetch time, and staff re-fetch the manifest to refresh. Record it in DATA_MODEL §12.5 and TECH_SPEC. |
| 4 | **`draft`, `scheduled` and `failed`** releases may be previewed; `failed` can be retried. Refuse `publishing`, `published` and `cancelled` with a clear 409. |
| 5 | **Only staff who can read the staging buckets:** writer, sound, editor and admin (DATA_MODEL §13). Viewers and moderators can't read staged audio in the admin, so preview mustn't give it to them. Return 403 for other roles and 401 without a staff JWT. |
| 6 | **A small summary on the release page:** groves, fragments, asset count and expiry, from a "Check preview" button. No QR or phone hand-off until M5. Integration tests are the acceptance bar. |
| 7 | **Nested:** `/story/groves/[groveId]/fragments/[fragmentId]/revisions` (list), `/new`, and `/[revisionId]`, reusing the fragment context. Link to it from the fragment form. |
| 8 | **No `in_review`** (DATA_MODEL §1 says it's hidden in the admin). Writers work in `draft`. |
| 9 | **Hide sound-entity items until M4.** No UUID entry. |
| 10 | See **D4**: the warning comes in the confirm step, before the commit. |
| 11 | **Per-entity pages are the primary entry** (revision, fragment, grove, character), editor+ only. The Releases area lists unpublish events in history through the audit log. |
| 12 | **A failed release can be retried** (DATA_MODEL §8). Editing its items or rescheduling it returns it to `draft` (or `scheduled`), and "Retry" re-runs publish. `cancelled` is terminal; offer "Copy items into a new draft release". |
| 13 | **Store `timestamptz` (UTC); display and enter in the browser's local time,** with the zone abbreviation shown (e.g. "MST"). Releases are story-wide, not regional. |
| 14 | **Running the check stays editor+** (it writes `last_check`). All staff can **read** `last_check` on the release page, rendered with the same component. |
| 15 | **VTT is optional, with no warning** in M3d. |
| 16 | **No automatic teaser validation** for time-limited fragments. The hint is authored text (ADR 0004). The E2E Day-only fragment just needs a teaser. |
| 17 | **Already satisfied in M3c.** Keep those tests green; don't re-assert them. |
| 18 | **N3 moves to M4.** Record it in BUILD_PLAN's M4 section. |
| 19 | **No auto-shell.** The writer clicks "Add first revision". For revision 1, the form shows **Story Contingency** selected and locked, with "The first revision of a fragment is always a Story Contingency." That's the only valid value, not a default. From revision 2 on, the choice is required, with nothing preselected. |
| 20 | **One English transcript per version row.** Versions are already per language and time window. Hide the language selector (answer 24). |
| 21 | **Add `PACK_BUILD_FAILED`** to the DATA_MODEL §11 table as a release-level error, and render it with the same component. |
| 22 | **Order:** `publish_at`, then `created_at`. Each release goes live atomically on its own. No other promise. |
| 23 | **Confirmed:** preview carries `markerHash` only, never codes, and signed URLs never contain codes. Add a test (D3). |
| 24 | **Hide the language selector;** every version is `en` (ADR 0004 §26). |
| 25 | **Show every code the shared helpers produce.** They're accurate, and hiding them would only confuse staff. |

## Notes
- **Draft-check parity (M3c carry-forward):** extract `fn_check_revision_local` as planned. `fn_publish_check` and `fn_draft_check` both call it, and the `067`-style parity test extends to revision and audio codes.
- **Publish now** returns once the commit is done, but packs build asynchronously. The release page shows "Publishing…" and refreshes until the release is `published` or `failed`.
- **No AI generation:** transcripts, change notes and titles are typed by staff.
- **Doc amendments** (quote them in the report): DATA_MODEL §8 (answer 1), §11 (answer 21) and §12.5 (D3, answer 3); TECH_SPEC (preview TTL and roles); BUILD_PLAN M4 (N3).
- **Edge runtime on Windows** (plan §1 note): keep CI's parallel `functions serve`. Locally, a missing `supabase/.env.local` shouldn't block anyone: `pnpm db:setup-local` should print a clear message, and the README should say how to create the file.

## Report back with (in addition to the brief's list)
- The D1 trigger tests and the integration "published revision edit refused" result
- The D3 refactor: which code `build-pack` and `preview` now share, and the `PreviewManifest` zod
- The D4 preview/commit parity test
- Playwright: from-scratch publish, writer refusal (no button, forced call → 403), scheduled publish or fail with visible reasons
- Screenshots: the revision editor (first-revision lock), the release checklist with grouped failures, and the unpublish confirm with stranded warnings

**Then stop for architect review of the report.**
