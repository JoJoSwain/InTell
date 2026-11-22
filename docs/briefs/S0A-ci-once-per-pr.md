# S0A brief (Lane A): CI runs once per PR

**Lane:** A (Platform) · **Branch:** `a/s0-setup` (in `C:\dev\intell-lanes\a`; this brief and the setup docs are already committed) · **Implement directly**, open a PR, then stop for review. This is the two-lane dry run: small on purpose.

## Why

`.github/workflows/ci.yml` triggers on `push` for every branch **and** on `pull_request`. The two events land in different concurrency groups (`github.ref` is `refs/heads/<branch>` for one and `refs/pull/<n>/merge` for the other). So every push to a PR branch runs the whole suite **twice at once**, which caused the "sibling db race" re-triggers during M3h. With two lanes, that doubles CI time for nothing.

## Change

1. **Triggers:**
   ```yaml
   on:
     push:
       branches: [master]
     pull_request:
   ```
2. **One concurrency group per PR** (and per branch for `master` pushes):
   ```yaml
   concurrency:
     group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
     cancel-in-progress: true
   ```
   Update the comment above it to say why.
3. **Keep the job names `check` and `db` exactly as they are.** Branch protection will require them by name.
4. Nothing else changes in CI.

## Acceptance
- [ ] On the PR, each push produces **one** `check` and **one** `db` run, both green, plus the Vercel check.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally. A CI-only change needs no database suite run locally.

## Report
Write `docs/briefs/S0A-report.md` covering:
- the start label `Lane A · S0A`
- the diff to `ci.yml`, quoted
- a link to the PR's checks list showing a single run per push
- `git log --oneline origin/master..HEAD`

**Then stop for review.** Push with `git push -u origin a/s0-setup`.
