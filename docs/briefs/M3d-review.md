# M3d revisions, releases and preview: architect review of the implementation

**Reviewed:** `docs/briefs/M3d-report.md` and `m3d-releases` at `f4d9448` (PR #11), against `M3d-plan.md` and `M3d-plan-review.md`, including the screenshots
**Verdict:** **Changes requested: four required fixes (E1–E4).** Fix on PR #11, then stop for verification.
**Reviewer:** architect (Claude), 2026-11-20

**Also on this branch:** commit `fdfe5c2` (docs only) adds **ADR 0005** and its spec amendments, plus the M3e brief. Push it with this review. It merges with M3d. ADR 0005 resolves the "known ADR 0004 opens" in report §6, apart from children's Journal privacy.

The core work is right:
- D1 immutability and D2 numbering, the shared draft and publish revision checks
- `fn_unpublish_preview` built on the shared helper
- the preview overlay sharing `buildGrovePackObject`
- the release UI, and the first-revision lock

But M3's headline acceptance isn't met yet (E1), and a release bypass remains (E2).

---

## Required

### E1. Meet the M3 acceptance as written
The report softens BUILD_PLAN's M3 acceptance, and that acceptance is the bar for the whole milestone. The from-scratch Playwright test must:
1. Build a **new** grove with a physical marker, a Day-only fragment **and a prerequisite on a published fragment in the seed grove** (cross-grove).
2. Publish it in **one** release and **hard-assert** that the release reaches `published`. Drain the jobs deterministically: the test calls `run-jobs` (or waits on it) until the release's builds are live. No `published || publishing`.
3. Find the grove in `get_pack_index`, fetch its manifest, and **validate it with the shared `GrovePack` zod**. Assert that the physical fragment carries `markerHash` and no code, that the Day-only fragment has only a `day` version, and that `externalPrerequisites` lists the seed-grove member.

If "Add missing items" can't satisfy the checklist for a new grove, that's a bug to fix, not a reason to soften the test. A new grove with no sound entities shouldn't depend on anything M4 adds. Report the root cause you found.

### E2. Revision status can still bypass releases
Packs read **current published revisions directly** (`fn_current_revision` → `fn_revision_is_playable` checks `status = 'published'`). D1 blocks edits to *non-draft* revisions, but:
- an **editor** can `UPDATE` a **draft** revision (with versions) to `status = 'published'` through PostgREST. The update policy is unconditional for editors, and D1 checks only `old.status`. The next pack rebuild of that grove then ships it with no release and no checklist.
- any writer or editor can `INSERT` a revision with a non-draft `status` or a `release_id`.

That breaks FR-16 ("content reaches phones only through published releases").

**Fix (new migration):** for `auth.role() = 'authenticated'`:
- **on INSERT:** require `status = 'draft'` and `release_id is null`
- **on UPDATE:** refuse any change to `status` or `release_id`

Only the service-role commits change them.

**pgTAP:**
- an editor setting a draft to `published` is refused
- an insert with `status = 'published'` is refused
- setting `release_id` is refused
- the publish and unpublish commits still work

### E3. Admins can't use preview
`preview` looks up the caller with `caller.from("staff").select("role, active").maybeSingle()` and no filter. RLS lets an **admin** read every staff row, so `maybeSingle()` errors on multiple rows and admins get **401**.

**Fix:** resolve the caller with `auth.getUser()` and filter `.eq("user_id", userId)`, or call `has_role` through an RPC. Add an integration case: an admin can preview.

### E4. Show the stranded warning actually working
The unpublish screenshot shows "No stranded-prerequisite warnings", so the feature D4 exists for, warning *before* commit, has no visible test. Add a Playwright case that unpublishes a fragment that is a prerequisite of a fragment in **another** grove. Assert the confirm dialog names the stranded fragment before anyone clicks Confirm, then cancel. Replace the screenshot with this case.

---

## Nits (fix if cheap)
- **N1.** Postgres doesn't check `EXECUTE` on trigger functions for the triggering role, and a function returning `trigger` can't be called directly. So the `grant execute … to authenticated` on the three new trigger functions is unnecessary, and the comments saying it's needed for the trigger to fire are inaccurate. Revoke them, and remove `fn_fragment_revision_assign_no()` from the `110` allowlist, keeping the allowlist to callable definers. Prove the triggers still fire for writers and editors.
- **N2.** The report says "CI / Vercel: recorded after push". Record the actual status on the new head.

## Accepted
- **Cross-grove coverage moving out of E2E:** not accepted. See E1.
- **N3 moved to M4:** accepted, and it's in BUILD_PLAN.
- **`publishing` badge timing and the `PACK_BUILD_FAILED` handling:** accepted.

## Report back with
- New commits since `f4d9448`, including the pushed `fdfe5c2`
- pgTAP, integration and Playwright counts, naming the new E1–E4 tests
- E1: the root cause of the earlier "Add missing" gap, and the validated pack assertions
- PR #11 CI and Vercel status on the new head
- Which nits were fixed

**Then stop for verification.** After M3d merges, the next brief is `docs/briefs/M3e-story-fields.md` (plan first, then stop).
