# Replaceplace · InTell (v2)

Monorepo for **InTell**, Replaceplace’s native InDigeny place-story app.

> Specs (authoritative): [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) and the docs it lists.  
> Architecture synthesis: [`docs/intell-v2-architecture.md`](docs/intell-v2-architecture.md)  
> Gap vs v0 spike: [`docs/intell-v2-gap-and-decisions.md`](docs/intell-v2-gap-and-decisions.md)  
> Build order: [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md)

## Layout

```
apps/mobile     Expo Router — map-home listener (M0 shell)
apps/admin      Next.js staff tools (M0 shell)
packages/shared zod schemas + pure logic (expands each milestone)
supabase/       migrations & edge functions (M2+)
tools/landcover NLCD → H3 grid (M4)
docs/           PRODUCT_SPEC … BUILD_PLAN + ADRs
```

Legacy prototypes (`App.js/`, and the PR #1 `apps/intell` list/browse spike on another branch) are **not** the v2 product surface.

## Quick start

```bash
pnpm install
pnpm --filter @intell/shared test
pnpm --filter @intell/admin dev      # http://localhost:3000
pnpm --filter @intell/mobile start  # Expo; use web if no simulator
```

Root checks: `pnpm lint && pnpm typecheck && pnpm test`

Copy `.env.example` → `.env` / EAS secrets as needed. Supabase local: `npx supabase start` (after M2 migrations exist).

## Milestone posture

Work **M0 → M12** in order (one branch / PR each). Do not extend the v0 browse demo as map-home.
