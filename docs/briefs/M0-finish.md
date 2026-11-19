# Brief: finish M0 (scaffold) and clean up the repo

**Milestone:** M0 (BUILD_PLAN), finishing pass
**Branch:** `cursor/intell-v2-m0-scaffold-8134` (the current branch), plus one preservation branch
**Author:** architect (Claude), 2026-11-19
**Read first:** `AGENTS.md`, `docs/BUILD_PLAN.md` (M0), `docs/adr/0002-map-provider.md`

## Goal
Leave M0 clean, committed and green, so M1 (the audio engine spike) can start from a trustworthy base. Preserve the Google Maps home-map work without merging it into M0.

## Out of scope (don't do these)
- Any change to map behavior, markers or providers (blocked by ADR 0002)
- Any M1+ work (audio, database, packs, admin features)
- `expo prebuild`, native builds, device installs, or touching `apps/mobile/.env`
- Deleting the Google Maps key wiring (it moves to the preservation branch)

---

## Part A: preserve the map work (do this first)
1. Run `git status` and paste the output in your plan. At review time, the home-map pass appeared to be **uncommitted** on this branch. The expected changed or untracked files are below; **verify, don't assume**:
   - `apps/mobile/src/map/MapHome.tsx`, `apps/mobile/src/map/demoContent.ts`, `apps/mobile/src/ui/tokens.ts`
   - `apps/mobile/app/index.tsx`, `apps/mobile/app.config.js`, `apps/mobile/package.json`, `apps/mobile/.env.example`
   - `.env.example` (root), `docs/intell-home-map-notes.md`, `pnpm-lock.yaml`
   - New guardrail files from the architect (these stay on M0, see Part B): `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/intell.mdc`, `apps/mobile/AGENTS.md` (modified), `docs/adr/0002-map-provider.md`, `docs/briefs/*`
2. `git switch -c preview/m5-google-map-home`
3. Stage **only the map files** from step 1 (not the guardrail files). Commit: `preview(m5): Google Maps home map demo (pending ADR 0002)`. Push the branch. **Don't open a PR to merge it.**
4. `git switch cursor/intell-v2-m0-scaffold-8134`. Confirm the map files are back to their M0 stub state and the guardrail files are still present as uncommitted changes.
5. Make sure `apps/mobile/.env` was never committed on either branch (`git log --all -- apps/mobile/.env` returns nothing). If it was, **stop and report**; don't try to rewrite history.

## Part B: commit the agent guardrails
Commit the guardrail files listed in A.1 as `chore: add AGENTS.md, CLAUDE.md, Cursor rules, ADR 0002, briefs`.

## Part C: one copy of the specs
1. Delete `docs/specs/` (it's identical to `docs/*.md`; verify with a diff before deleting and report the result).
2. Replace every reference to `docs/specs/` with `docs/` (check `README.md`, `docs/README.md`, `docs/intell-v2-architecture.md`, `docs/intell-v2-gap-and-decisions.md`).
3. Update the `docs/README.md` table: remove the `specs/` row; add rows for `adr/0002-map-provider.md` (Proposed) and `briefs/`.

## Part D: legacy cleanup
1. `git mv "App.js" "_ Archive/legacy-firebase-prototype"`. Confirm nothing in `apps/`, `packages/` or `tools/` imports from it, and that `pnpm-workspace.yaml` doesn't include it.
2. Delete `pixel-intell-shot.png` from the repo root. It isn't a valid image (PowerShell wrote it as UTF-16 text). Use `git rm` if it's tracked.
3. Update the "Legacy prototypes" line in `README.md` to point at `_ Archive/legacy-firebase-prototype`.

## Part E: toolchain alignment
1. **TypeScript:** mobile pins `~6.0.3`; root, shared and admin use `~5.9.2` / `^5`. Run `pnpm exec expo install --check` in `apps/mobile` and use the version the Expo SDK expects. Align root, `packages/shared` and `apps/admin` to the same range. Report the version chosen and why.
2. **Admin lint:** align `eslint-config-next` with the installed `next` version. Check the docs for the installed Next version: if `next lint` is deprecated there, switch the `lint` script to the ESLint CLI with a flat config.
3. **shadcn/ui** in the admin (M0 scope): initialize it (`components.json`, `src/lib/utils.ts` with `cn`), add a `Button` component, and render one on the admin home page. **First check the shadcn docs for compatibility with the installed Tailwind major (v3.4).** Prefer staying on the installed major unless shadcn requires an upgrade, and report the choice.
4. **Admin tokens:** add DESIGN §1.1 light tokens to `apps/admin/tailwind.config.ts` (`bg`, `surface`, `text`, `textMuted`, `primary`, `root`, `branch`, `leaf`, `accent`, `seed`, `water`, `border`, `warning`, `danger`). Replace the raw hex values in `apps/admin/src/app/page.tsx` with token classes.
5. **Mobile lint:** make `pnpm --filter @intell/mobile lint` work non-interactively (add the Expo flat ESLint config per the versioned Expo docs).

## Part F: CI
1. In `.github/workflows/ci.yml`:
   - run `pnpm lint` (all packages through turbo) instead of admin-only lint
   - keep `typecheck`, `test` and the admin build
   - trigger on pushes to all branches (`branches: ["**"]`) and on pull requests
2. Confirm locally, and paste the results: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @intell/admin build`.

---

## Acceptance criteria
- [ ] `preview/m5-google-map-home` exists on origin with the map work; no PR opened for it
- [ ] The M0 branch is clean (`git status` empty after the final commit), with the guardrail files committed
- [ ] `docs/specs/` removed; no remaining references to it; `docs/README.md` updated
- [ ] `App.js/` moved to `_ Archive/legacy-firebase-prototype`; the bad PNG removed
- [ ] One TypeScript range across the workspace; admin lint works; shadcn initialized with a Button; admin uses tokens
- [ ] `pnpm lint && pnpm typecheck && pnpm test` and the admin build are green locally and in CI
- [ ] The mobile app still starts (`pnpm dev:mobile` boots Metro without errors; no device install needed)

## Report back with
1. The `git status` output from Part A.1, and the final `git log --oneline -10`
2. The command outputs from F.2
3. Version choices (TypeScript, ESLint/Next, shadcn/Tailwind) and the reasons
4. Anything you skipped, and any ambiguities or surprises
