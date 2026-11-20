# M2a PR report — architect fixes + PR

**Branch:** `m2a-schema` → `master`  
**PR title:** `M2a: schema, story graph, playability, RLS, seed`  
**M2b:** not started

## Architect fixes

1. GPX pace **1.4 m/s** (one point/sec, **1.4 m** apart) — fixture + generator
2. Music zone clipped to **east** of `-111.9235` (`lng > -111.9235`)
3. pgTAP `016_seed_geometry_dropped.test.sql`: `public._seed_geometry` absent after seed

## Checks

| Command | Result |
|---|---|
| `pnpm exec supabase db reset` | PASS |
| `pnpm exec supabase test db` | PASS — **19 files, 79 tests** |
| `pnpm lint && pnpm typecheck && pnpm test` | PASS (shared Vitest 30/30) |

## GPX

- **Point count:** 1806  
- **Duration:** 1806 s
