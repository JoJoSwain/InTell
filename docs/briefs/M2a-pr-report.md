# M2a PR report — architect fixes + PR

**Branch:** `m2a-schema` → `master`  
**PR:** https://github.com/JoJoSwain/InTell/pull/3  
**PR title:** `M2a: schema, story graph, playability, RLS, seed`  
**M2b:** not started

## Architect fixes

1. GPX pace **1.4 m/s** (one point/sec, **1.4 m** apart) — fixture + generator
2. Music zone clipped to **east** of `-111.9235` (`lng > -111.9235`)
3. pgTAP `016_seed_geometry_dropped.test.sql`: `public._seed_geometry` absent after seed
4. **GPX dwell on arrival** (before leaving) — no teleport jumps; Vitest in `@intell/demo-geometry`

## Checks

| Command | Result |
|---|---|
| `pnpm exec supabase db reset` | PASS (prior) |
| `pnpm exec supabase test db` | PASS — **19 files, 79 tests** |
| `pnpm lint && pnpm typecheck && pnpm test` | PASS (includes demo-geometry Vitest 4/4) |

## GPX

- **Point count:** 1798  
- **Duration:** 1798 s  
- Consecutive spacing ≤ 2 m; dwell ≥ narration+5 s inside each non-protected fragment; never inside frag9 radius
