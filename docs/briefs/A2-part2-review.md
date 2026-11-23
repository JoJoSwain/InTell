# A2 Part 2 review (Lane A): the database and the admin

**Tip reviewed:** `99d7068` · **Brief:** `docs/briefs/A2-review.md` (plan steps 9–10 plus P1)

## Verdict

**Accepted, with one small fix (R1).** It's ready to merge once R1 is pushed and both `check` and `db` are green. That includes the Playwright specs, which weren't run locally.

## What Claude checked
- **Every function the migration redefines,** diffed against its latest earlier definition:
  - `get_pack_index`
  - `fn_fragment_guard`
  - `fn_set_fragment_location`
  - `fn_snapshot_projection`
  - `fn_check_fragment_local`
  - `fn_publish_check`

  Each one changes only what A2 removes: the drawn-boundary reads, the `ST_Covers` checks, `OUTSIDE_GROVE` and the snapshot's `boundary`. `get_pack_index` now reads `pack_builds.bbox`. Nothing else in those bodies moved.
- **The bbox:** it's backfilled before the column drop, it's written by the builder from the derived shape, and the index skips a grove build that has none.
- **The admin:** the far-piece warnings merge into the checklist without blocking go-live. The grove map is read-only, and Terra Draw stays for zones.
- **N4 (old snapshots):** they still parse, because `boundary` is now optional.

## Required change
**R1. Stop paging on an empty page, not a short one.**
- **The risk:** `pagePublishedSnapshots` defaults to a page size of 1000, which is exactly `max_rows`, and it stops on the first page shorter than that. If `max_rows` is ever lowered (say to 500), the first page comes back with 500 rows, the loop stops, and the list is silently cut. That's the bug P1 exists to prevent.
- **The fix:** keep requesting pages until one comes back **empty**. That costs one extra request.
- **Test:** add a case where the server returns fewer rows per page than requested.

## Note
- **Staging order matters after the merge.** Vercel deploys the admin at once, but staging's database still has the not-null `groves.boundary`, and its edge functions predate A2. So right after the merge, Jordan pushes both A2 migrations, then deploys all functions, with Claude walking him through it. Nothing on staging is public, so the few minutes in between don't matter.

## Next
1. Push this review, then fix R1 with its test, and push.
2. Stop. Jordan merges when both checks are green, and Claude then walks him through the staging update.
