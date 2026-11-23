# A2 review (Lane A): Part 1

**Tip reviewed:** `a1adcc1` · **Brief:** `docs/briefs/A2-grove-boundary.md` · **Plan and plan review:** `A2-plan.md`, `A2-plan-review.md`

## Verdict

**Part 1 is accepted.** It's ready to merge once `check` (which now includes the mobile export) and `db` are green on the PR.

## What Claude checked
- **The diff, read in full:** the shared code, the builder and the migration.
  - The new `fn_publish_commit` body was diffed against the M3a version. The only changes are the linked-grove call, the alias rename (`g` → `gr`) and the removed per-fragment loop that it replaces.
- **An independent property run** against the `from-shared` copies:
  - **Scale:** 1,500 random layouts (1–60 fragments, spread over 80 m to 1.5 km), about 297,000 sample points and 1.6 million vertices. **No failures.**
  - **Vertex accuracy:** the largest vertex error was **7 mm**, against a 5 cm budget.
  - **Points:** every point inside a circle is inside the shape, and every extra inside point is enclosed (a filled gap).
  - **Determinism:** shuffled input gives identical JSON.
  - **Arrow tip:** a 1 km link from a lone Root puts the tip at 106.68 m, which is 76.2 + 30.48.
- **R1–R3** are done as asked, and **N3 is confirmed** (`NO_ROOT` already blocks a grove with no opening root).

## Notes (no change needed)
- **N1. Exact tangency.** Two circles that touch to within 0.1 mm give one ring that touches itself at the contact point. That's harmless for drawing and for point-in-polygon, and real placements won't land on it.
- **N2. The Farmington test grove is now 5 pieces.** That's the decided rule working on test data spread along a trail. Claude is telling Jordan.
- **N3. The dense case** (146–375 ms) is fine for the builder. The phone calls `groveShape` with `extraM` for the halo, and Lane B measures that on a device.

## Part 2: one addition to its scope
- **P1. The builder's fragment query can be silently cut off.** It reads every published fragment snapshot in one request, and PostgREST caps responses at `max_rows = 1000` (`supabase/config.toml`). Past 1,000 published fragments, the list is cut without an error, and another grove's shape or its links can come out wrong.
  - **The fix:** page through the results, or query only this grove's fragments plus those of the groves linked to it.
  - **Test:** a fixture with more than 1,000 rows, using a lowered limit, if that's practical.
- **Otherwise,** Part 2 follows the plan (steps 9–10) and plan-review N4 (old snapshots that still carry `boundary` must still parse).

## Next
1. Push this review (docs only).
2. **Jordan merges PR 1** once its checks are green, with a merge commit.
3. **Part 2:**
   - Fetch, and cut `a/a2-part2` from `origin/master`.
   - Build plan steps 9–10, plus P1.
   - Write `docs/briefs/A2-part2-report.md`, starting with `Lane A · A2 Part 2`.
   - Open a PR titled "A2 Part 2: database and admin", and stop for review.
4. **Staging is updated once, after Part 2:** migrations, functions and a republish, with Claude walking Jordan through it.
