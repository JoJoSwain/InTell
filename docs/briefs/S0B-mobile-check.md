# S0B brief (Lane B): mobile workspace health check (report only)

**Lane:** B (Mobile) · **Branch:** `b/s0-mobile-check` (in `C:\dev\intell-lanes\b`; this brief and the setup docs are already committed) · **No code changes.** Write a report, open a PR, then stop. This is the two-lane dry run, and it also gives Claude the facts for the M5a brief.

## Do (read and run only; change nothing under `apps/` or `packages/`)

1. **Checks:** run `pnpm --filter @intell/mobile typecheck` and `pnpm --filter @intell/mobile lint`, plus `pnpm --filter @intell/shared test`. Record the results.
2. **Dependencies:** run `pnpm --filter @intell/mobile exec expo-doctor` (or `npx expo-doctor` from `apps/mobile`). List any warnings, without fixing them.
3. **Bundling without a device:** run `pnpm --filter @intell/mobile exec expo export --platform android --output-dir <a temp folder outside the repo>`. Does Metro bundle? Note the time and any errors.
4. **Inventory of `apps/mobile`:** routes in `app/`, the contents of `src/`, the `e2e/` assets, `app.json`/`eas.json` settings (bundle ID, plugins, maps keys as **names only**), and the native `android/` project state.
5. **`origin/preview/m5-google-map-home`**, which M5 says to finish on top of. Read it only, with `git log` and `git diff origin/master...origin/preview/m5-google-map-home --stat`. Summarize what it contains, how far behind `master` it is, and whether it still matches ADR 0004/0005 (Embark center, no Grow tab, etc.).
6. **Gaps for M5a:** what M5a needs that doesn't exist yet. That covers the device database (and where it's stored, so the OS backup includes it), pack download and sync, device registration, staff preview, and a unit-test runner for mobile (`test` is a placeholder today).

**Don't:** run `supabase start`, `db reset`, `pnpm db:setup-local` or any admin Playwright suite. The local database belongs to Lane A.

## Report
Write `docs/briefs/S0B-report.md`:
- Start it with `Lane B · S0B`.
- Give each section a short result: the checks, expo-doctor, bundling, the inventory, the preview branch, and the gaps for M5a.
- Never include key values.

Commit it, push with `git push -u origin b/s0-mobile-check`, and open a PR against `master`. **Then stop for review.**
