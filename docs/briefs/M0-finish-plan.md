# Plan: Finish M0 (scaffold cleanup)

**Status:** APPROVED by JoJo (2026-11-19) — implement with the hard conditions below  
**Brief:** `docs/briefs/M0-finish.md`  
**Working tree:** `C:\Users\jorda\source\Replaceplace`  
**Current branch:** `cursor/intell-v2-m0-scaffold-8134`  
**AGENTS.md:** read (repo root + `apps/mobile/AGENTS.md`)  
**Related:** `docs/BUILD_PLAN.md` M0, `docs/adr/0002-map-provider.md` (Proposed)

---

## JoJo hard conditions (must obey)

1. **`.cursor/` decision:** Commit `.cursor/rules/`. In `.gitignore`, replace `.cursor/` with:
   ```
   .cursor/*
   !.cursor/rules/
   ```
   Then `git add .cursor/rules/intell.mdc` as part of the guardrails commit, and confirm `git check-ignore .cursor/rules/intell.mdc` returns nothing.

2. **Restoring M0 stubs:** Only by committing map work on `preview/m5-google-map-home` then switching back. Do **NOT** hand-edit files to recreate stubs. After switching back, show:
   `git diff origin/cursor/intell-v2-m0-scaffold-8134 -- apps/mobile/app/index.tsx apps/mobile/app.config.js apps/mobile/package.json pnpm-lock.yaml`
   It must be empty. **STOP if Part A doesn’t match expectations.**

3. Before deleting `docs/specs/`, show the diff result proving the two copies are identical. Also show `git log --all -- apps/mobile/.env` (must print nothing).

4. Save this approved plan (with conditions) to `docs/briefs/M0-finish-plan.md` and include it in the guardrails commit.

5. Commit each part separately (A through F), clear message each.

6. Finish with the report from the brief.

### Other constraints

- Do not invent product/map features; ADR 0002 Proposed.
- No expo prebuild, native builds, device installs, or touching `apps/mobile/.env`.
- Keep secrets out of git.
- Leave lint/typecheck/test green per AGENTS.md.
- JoJo local-first; push `preview/m5-google-map-home` (no PR unless brief says). Prefer following `M0-finish.md` + this plan.
- Do not resume Pixel install.

---

## Constraints from AGENTS.md (will follow)

- Plan first; wait for approval; one milestone/brief at a time.
- Do not invent product behavior; ADR 0002 Proposed → **no new map features**.
- No `expo prebuild`, native builds, device installs, or touching `apps/mobile/.env`.
- Keep secrets out of git; `.env` stays gitignored.
- Ask before adding dependencies not in TECH_SPEC §1; mobile packages via `pnpm exec expo install`.
- Leave `pnpm lint && pnpm typecheck && pnpm test` green.
- Specs live in `docs/` only (one copy).

---

## Part A.1 — `git status` (raw)

Verified on this machine before planning. Home-map work is **uncommitted**, as the brief expected.

```
On branch cursor/intell-v2-m0-scaffold-8134
Your branch is up to date with 'origin/cursor/intell-v2-m0-scaffold-8134'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in the working directory)
	modified:   .env.example
	modified:   apps/mobile/AGENTS.md
	modified:   apps/mobile/app/index.tsx
	modified:   apps/mobile/package.json
	modified:   pnpm-lock.yaml

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	AGENTS.md
	CLAUDE.md
	apps/mobile/.env.example
	apps/mobile/app.config.js
	apps/mobile/src/
	docs/adr/0002-map-provider.md
	docs/briefs/
	docs/intell-home-map-notes.md
	pixel-intell-shot.png

no changes added to commit (use "git add" and/or "git commit -a")
```

**Short status / branch context:**

```
## cursor/intell-v2-m0-scaffold-8134...origin/cursor/intell-v2-m0-scaffold-8134
 M .env.example
 M apps/mobile/AGENTS.md
 M apps/mobile/app/index.tsx
 M apps/mobile/package.json
 M pnpm-lock.yaml
?? AGENTS.md
?? CLAUDE.md
?? apps/mobile/.env.example
?? apps/mobile/app.config.js
?? apps/mobile/src/
?? docs/adr/0002-map-provider.md
?? docs/briefs/
?? docs/intell-home-map-notes.md
?? pixel-intell-shot.png
* cursor/intell-v2-m0-scaffold-8134 5130faf [origin/cursor/intell-v2-m0-scaffold-8134] fix(ci): let packageManager drive pnpm version
```

**Recent commits:**

```
5130faf fix(ci): let packageManager drive pnpm version
66095f0 feat(intell): M0 monorepo scaffold + v2 architecture docs
ae91b61 docs: Add GitHub setup and collaboration guide
```

### File classification (verified)

| Bucket | Paths |
| --- | --- |
| **Map / preserve (Part A)** | `apps/mobile/src/map/MapHome.tsx`, `apps/mobile/src/map/demoContent.ts`, `apps/mobile/src/ui/tokens.ts`, `apps/mobile/app/index.tsx`, `apps/mobile/app.config.js`, `apps/mobile/package.json`, `apps/mobile/.env.example`, root `.env.example`, `docs/intell-home-map-notes.md`, `pnpm-lock.yaml` |
| **Guardrails (Part B, stay on M0)** | `AGENTS.md`, `CLAUDE.md`, `apps/mobile/AGENTS.md` (modified), `docs/adr/0002-map-provider.md`, `docs/briefs/*`, `.cursor/rules/intell.mdc`, `.gitignore` (`.cursor/` exception) |
| **Cleanup later (Part D)** | `pixel-intell-shot.png` (untracked; leave off both A and B commits) |
| **Local only — never stage** | `apps/mobile/.env` (exists on disk, gitignored via `**/.env`; `git log --all -- apps/mobile/.env` is empty) |

### Surprises / ambiguities — resolved

1. **`.cursor/rules/intell.mdc`:** JoJo approved committing `.cursor/rules/` via the `.gitignore` exception above.
2. **`apps/mobile/src/ui/tokens.ts`:** Classified as map-preserve; after Part A switch-back, M0 will not have tokens until M5 — intentional stub state.
3. Root **`App.js` is a directory** (legacy Firebase prototype), matching the brief’s `git mv "App.js" "_ Archive/legacy-firebase-prototype"`.

---

## Implementation order

### Part A — Preserve map work (first; no PR)

1. Re-run `git status` immediately before branching (confirm nothing else landed).
2. `git switch -c preview/m5-google-map-home`.
3. Stage **only** the map bucket above. Commit:  
   `preview(m5): Google Maps home map demo (pending ADR 0002)`  
   Push `preview/m5-google-map-home`. **Do not open a PR.**
4. `git switch cursor/intell-v2-m0-scaffold-8134`. Confirm map paths revert to M0 stubs via branch switch only (no hand-edits). Required diff vs `origin/cursor/intell-v2-m0-scaffold-8134` for `apps/mobile/app/index.tsx`, `apps/mobile/app.config.js`, `apps/mobile/package.json`, `pnpm-lock.yaml` must be empty. **STOP if not.**
5. Re-check `git log --all -- apps/mobile/.env` is empty. If not → **stop and report**.

### Part B — Commit agent guardrails (on M0 branch)

Commit message:  
`chore: add AGENTS.md, CLAUDE.md, Cursor rules, ADR 0002, briefs`

Include: `AGENTS.md`, `CLAUDE.md`, `apps/mobile/AGENTS.md`, `docs/adr/0002-map-provider.md`, `docs/briefs/*` (including this plan), `.gitignore` (`.cursor/*` + `!.cursor/rules/`), and `.cursor/rules/intell.mdc`. Confirm `git check-ignore .cursor/rules/intell.mdc` returns nothing.

### Part C — One copy of the specs

1. Diff `docs/specs/*.md` vs `docs/*.md` (same basenames); paste result in the finish report. Only delete if identical.
2. Delete `docs/specs/`.
3. Replace `docs/specs/` references with `docs/` in at least:  
   - `docs/README.md` (remove `specs/` table row)  
   - `docs/intell-v2-architecture.md`  
   - `docs/intell-v2-gap-and-decisions.md`  
   - root `README.md` if any refs appear  
4. Update `docs/README.md`: add `adr/0002-map-provider.md` (Proposed) and `briefs/`.

### Part D — Legacy cleanup

1. Confirm nothing in `apps/`, `packages/`, `tools/` or `pnpm-workspace.yaml` imports `App.js/`.
2. `git mv "App.js" "_ Archive/legacy-firebase-prototype"`.
3. Remove `pixel-intell-shot.png` (`git rm` if tracked; else delete — currently untracked).
4. Point README “Legacy prototypes” at `_ Archive/legacy-firebase-prototype`.

### Part E — Toolchain alignment

Current snapshots (for planning; re-verify at implement time):

| Package | Today |
| --- | --- |
| Expo | `~58.0.26` |
| Mobile TypeScript | `~6.0.3` |
| Root / shared TypeScript | `~5.9.2` |
| Admin TypeScript | `^5` |
| Next | `15.2.4` |
| `eslint-config-next` | `15.1.0` (behind Next) |
| Admin Tailwind | `^3.4.1` |

Steps:

1. **TypeScript:** In `apps/mobile`, run `pnpm exec expo install --check`. Align root, `packages/shared`, and `apps/admin` to the Expo-expected range. Report chosen version + why.
2. **Admin lint:** Align `eslint-config-next` to installed Next (`15.2.x`). If Next docs deprecate `next lint`, switch admin `lint` to ESLint CLI + flat config.
3. **shadcn/ui:** Check current shadcn docs vs Tailwind **v3.4**. Prefer staying on v3.4. Init `components.json`, `src/lib/utils.ts` (`cn`), add `Button`, render on admin home. Report Tailwind choice.
4. **Admin tokens:** Add DESIGN §1.1 light tokens to `apps/admin/tailwind.config.ts`; replace raw hex in `apps/admin/src/app/page.tsx` with token classes.
5. **Mobile lint:** Per Expo SDK 58 docs, add flat ESLint config so `pnpm --filter @intell/mobile lint` is non-interactive.

### Part F — CI

1. Update `.github/workflows/ci.yml`:
   - `pnpm lint` (turbo all packages) instead of admin-only lint
   - keep typecheck, test, admin build
   - triggers: pushes to all branches (`branches: ["**"]`) + pull requests
2. Locally run and paste:  
   `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @intell/admin build`
3. Smoke: `pnpm dev:mobile` boots Metro (no device install).

### Final report (after implementation)

Per brief + AGENTS.md §10: Part A.1 git status (already above), final `git log --oneline -10`, F.2 command outputs, version choices (TS / ESLint-Next / shadcn-Tailwind), skips and surprises.

---

## Explicitly out of scope (will not do)

- Map behavior / markers / providers (ADR 0002)
- M1+ (audio, DB, packs, admin features beyond E)
- `expo prebuild`, native builds, Pixel/device install, editing `apps/mobile/.env`
- Opening a PR for `preview/m5-google-map-home`
- Deleting Google Maps key wiring (moves to preservation branch)

---

## Commit sequence (M0 branch, after Part A)

1. Part B — guardrails  
2. Part C — specs dedupe + doc pointer updates  
3. Part D — legacy move + bad PNG  
4. Part E — toolchain / shadcn / tokens / lint  
5. Part F — CI + lockfile if needed  
