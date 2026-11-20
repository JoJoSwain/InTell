# Brief: <milestone or task title>

**Milestone:** M<N> (BUILD_PLAN)
**Branch:** `m<N>-<slug>` from `master` (or the stated base)
**Author:** architect, <date>
**Read first:** `AGENTS.md`, `docs/BUILD_PLAN.md` (M<N>), <the specific spec sections>

## Goal
<One or two sentences: what's true when this is done.>

## Decisions already made (don't revisit)
- <e.g. ADR 000X Accepted: …>
- <product defaults chosen for this milestone>

## Out of scope (don't do these)
- <adjacent milestones' work>
- <tempting "while I'm here" changes>

## Hard constraints most at risk in this milestone
- <pick the AGENTS.md §5 items this work could violate, and say how>

## Tasks
### Part A: <area>
1. …
### Part B: <area>
1. …

## Files and modules expected to change
- `packages/shared/src/...` (pure logic + tests)
- `apps/mobile/...`
- `supabase/migrations/...` (only one agent at a time)

## Acceptance criteria
- [ ] <copy from BUILD_PLAN M<N>, made testable>
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green locally and in CI
- [ ] Docs or ADR updated if behavior or stack changed

## Plan checkpoint
Produce a plan and **stop for architect review** before editing. The plan should include: the files to touch, any new dependencies (with reasons), the test approach, and a list of spec ambiguities.

## Report back with
1. A summary of the changes and the final `git log --oneline`
2. Command outputs for lint, typecheck and test (and any build)
3. Deviations from this brief, and why
4. Open questions
