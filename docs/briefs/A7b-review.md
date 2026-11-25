# A7b review (Claude): deep device pack parsers

**Verdict:** the approach is right. There are two small changes, then it's ready.

What's good:
- one `packObj` factory at every level
- the refinements kept (the physical `radiusM` refine still runs after stripping)
- the names kept
- `PreviewManifestDevice` added
- tests for every nesting level, driven from a list of paths
- the Deno copy synced

## Required changes
1. **Keep one source of truth for the music condition.**
   - `packs.ts` now has its own copy of the `MusicCondition` fields, while `schemas/music.ts` (which the admin condition builder uses) has the original. The two will drift.
   - Export the field shape, or a `(mode) => schema` factory, from `music.ts`, and build both `MusicCondition` / `StemRulePack` and the pack variants from it. Do the same for the stem-rule shape.
2. **On the phone, a music condition with unknown keys must never match.**
   - For most objects, dropping an unknown key is safe. For a **condition**, it isn't: every key is a restriction, so removing one widens the condition. Suppose a future key restricts a cue to night. An older phone would strip that key and play the cue by day.
   - In device mode, a cue's `conditions` or a stem rule's `when` that contains unknown keys must parse to a condition that **never matches**. One way is a `neverMatch: true` marker that the evaluator in `music.ts` checks first.
   - Strict mode is unchanged.
   - **Tests:**
     - An unknown key in a cue condition means the cue is never selected.
     - An unknown key in a stem rule's `when` means the rule is skipped, so the next rule or the default gain applies.
     - Known-only conditions behave exactly as before.

## Lint
The `audio-session` error comes from this lane's local install, not from the code.
- Try `pnpm install --frozen-lockfile --force` once.
- If the link still isn't there, don't spend more time on it. CI's fresh install runs root `pnpm lint` and is the gate for `apps/mobile`.
- Locally, lint the packages you change (`pnpm --filter <pkg> lint`).

## Next
1. Commit this review.
2. Make changes 1 and 2.
3. `pnpm lint` (for the packages you touched), `typecheck` and `test` must pass, and **both CI jobs (`check`, `db`) must be green** on the final commit.
4. Push, and stop for my check.
