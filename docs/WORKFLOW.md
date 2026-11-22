# InTell: two-lane build workflow (M4–M12)

**Status:** agreed Nov 22, 2026, and set up the same day after Milestone 3 merged (`dbc9412`).

**Who:** Jordan (relay, merges, hosted steps) · Claude (architect: briefs, reviews, the gate before every merge) · two Cursor agents, **Lane A** and **Lane B**.

**Goal:** keep two Cursor agents busy at once, each on its own branch and folder, without them colliding, and without anything reaching `master` before Claude has verified it and CI is green. Expected gain is about 1.5–2× throughput. The limits are the review queue and the relay, not the agents.

---

## 1. Lanes and ownership

| | Lane A: Platform | Lane B: Mobile |
|---|---|---|
| **Owns** | `supabase/**` (migrations, functions, seed, tests), `apps/admin/**`, `packages/shared/**`, `tools/**`, `.github/**` | `apps/mobile/**` |
| **Runs the local Supabase stack** | Yes (owner) | Uses Lane A's stack; never resets it |
| **Database changes** | Yes, **only this lane** | Never: asks Claude, who schedules it in Lane A |
| **Hosted follow-up after merge** | `db push --remote` / `functions deploy` when needed | None (app builds come in M12) |

**Claude owns** `docs/**` (specs, ADRs, briefs, reviews, this file), `AGENTS.md` and `.cursor/rules/**`. Agents edit docs only to write **their own report** (`docs/briefs/<ID>-report.md`), plus an app README when the brief says so.

**Cross-lane contracts.** Anything both lanes use (zod schemas, pack formats, endpoint request and response types, pure logic) lives in `packages/shared`. Lane A builds it and merges it **before** Lane B needs it. Lane B never edits `packages/shared`. If it needs a change, it stops and says so in its report.

**Rule of thumb:** if a task would make both lanes edit the same file, it's split into a Lane A piece (merged first) and a Lane B piece.

**Shared root files:**
- The root `package.json` (scripts, `pnpm.overrides`), `pnpm-workspace.yaml` and the root tool configs belong to **Lane A**.
- Each lane may add dependencies to **its own** package's `package.json`.
- `pnpm-lock.yaml` is never edited by hand. On a conflict, merge `origin/master`, run `pnpm install`, and commit the regenerated lockfile.

---

## 2. Folders and branches

- `C:\dev\intell`: the **main** checkout, always on `master`. Used for merges, `git pull`, and hosted `db push` / `functions deploy`. No agent works here.
- `C:\dev\intell-lanes\a` and `C:\dev\intell-lanes\b`: one **git worktree** per lane (they share the main repo's `.git`). Each is opened in its own Cursor window.
- Branch names: `a/<id>-<slug>` and `b/<id>-<slug>`, e.g. `a/m4a-shared-audio-logic`, `b/m5a-mobile-data`. Every branch is cut from the current `origin/master`.
- A lane folder holds one branch at a time. After a merge, Claude cuts the lane's next branch in that folder.
- A new lane branch starts out tracking `origin/master`. The agent's first push is always `git push -u origin <branch>`, which publishes it under its own name.
- The setup branches are `a/s0-setup` and `b/s0-mobile-check`.

---

## 3. The loop (per lane, same as today)

1. **Brief.** Claude writes `docs/briefs/<ID>-<slug>.md` and commits it on the lane's new branch in the lane folder. Big tasks get a plan step first (plan → plan review).
2. **Prompt.** Claude gives Jordan a prompt that **starts with the lane label**, e.g. `Lane A · M4a`. Jordan pastes it into **that lane's** Cursor window only.
3. **Build.** The agent implements, runs its lane's checks, pushes the branch, opens a PR against `master`, writes its report, and **stops**. Its report starts with the same lane label.
4. **Review.** Jordan relays the report. Claude reviews the diff and CI, then commits `docs/briefs/<ID>-review.md` on the lane branch. Claude commits **only while that lane's agent is stopped**.
5. **Fixes.** Required changes → the agent fixes them, pushes and stops → Claude adds a Verification section. Repeat until verified.
6. **Sync before merge.** If `master` moved since the review, the agent merges `origin/master` into its branch, re-runs checks and pushes. Claude re-checks the delta.
7. **Merge.** Jordan merges the PR with a merge commit, **one PR at a time**. A Lane A merge that changes the database or functions is followed by the hosted step from the main folder.
8. **Next.** At its next stop, the other lane syncs `master`. Claude cuts the next branch for the lane that just merged.

**Review queue:** first come, first served, except that work blocking the other lane jumps ahead. Every Claude reply ends with a one-line status: `Lane A: … · Lane B: …`.

---

## 4. Local test resources

- **One local Supabase stack per machine.** Every worktree uses the same ports (54321–54329) and container names (`project_id = "Replaceplace"`), so the stack is started from **Lane A's folder only**.
  - **Lane B:** points at that stack (same local URL and keys) for manual testing. It runs lint, typecheck and unit tests locally, and relies on CI for everything database-backed. It never runs `db reset`, `db:setup-local` or the admin Playwright suite.
  - **Lane A:** says in its report when it reset the database, because the seed restores demo data and Lane B's local state may change.
- **Per-lane setup:** each worktree needs its own `pnpm install` (fast, since the pnpm store is shared) and its own copies of the gitignored env files (`apps/admin/.env.local`, `supabase/.env.local`, the mobile env).
- **CI** runs every lane's full suite on its PR. That is the source of truth for database and end-to-end tests.

---

## 5. One-time setup (at the regroup, step by step with Jordan)

1. **Repo visibility:** stays **public**, decided Nov 22. That keeps Actions minutes free and branch protection available on GitHub Free. No secrets ever go in the repo. If it goes private later, move to GitHub Pro to keep branch protection.
2. **CI runs once per PR.** Today every PR push runs the suite **twice** (the `push` and `pull_request` events land in different concurrency groups), which caused the "sibling db race" re-triggers. Change it to run `pull_request` for PRs and `push` only on `master`, with per-PR concurrency. This is a small Lane A setup PR.
3. **Branch protection on `master`:** require a PR, require the `check` and `db` status checks, require branches to be up to date before merging, and block force pushes.
4. **Lane folders:** create both worktrees from the main folder. Install dependencies and copy the env files.
5. **Claude's access:** Jordan approves Claude's access to `C:\dev\intell-lanes` once, so Claude can commit briefs and reviews in each lane folder.
6. **Cursor:** open each lane folder in its own Cursor window and name the windows "Lane A" and "Lane B".
7. **Lane rule:** Claude adds `.cursor/rules/lanes.mdc`. It tells every agent to read this file, stay inside its lane's ownership, start reports with the lane label, never edit another lane's area or the specs, and stop for review.
8. **Dry run:** each lane gets a tiny first task to prove the loop end to end before real milestone work:
   - **S0A (Lane A):** CI runs once per PR.
   - **S0B (Lane B):** a report-only health check of the mobile workspace.

---

## 6. Tentative lane roadmap (refined at the regroup)

Lane B (mobile) is the long pole. Lane A stays one step ahead of it, delivering the shared logic and server pieces Lane B will need, and works on admin and analytics in between.

**Lane A (Platform)**
0. **A1, the M5a enablers (S0B review D3–D4):** the `register-device` edge function, a pure sync-diff helper in `packages/shared`, and scoping the root React override so mobile gets the version its Expo SDK expects.
1. **M4a:** the shared time, unlock, trigger, ambience, music and Hush logic in `packages/shared`, with AUDIO_SPEC §9 tests. M5 uses `unlock.ts` and `timeWindow.ts`, so this goes first.
2. **M4b:** admin sound design and the Listening Simulator. It carries M3c N3 (the loudness Web Worker), M3e F2 (a typed pack-build error) and M3f K1–K3 (the key cleanups).
3. **Server pieces for M5:** the `embark` relay (Routes API key, `embark_usage` cap, origin never stored or logged), plus any pack or device endpoints M5 needs.
4. **M11:** analytics ingest, dashboard, delete-device-data and export. These can be built from TECH_SPEC §8–9 with fixtures.
5. **Pure logic ahead of Lane B:** the session state machine (M6), AudioDirector rules (M7) and Chronicle selectors (M8), all in `packages/shared` with tests.
6. **M9 server and admin parts,** after the Journal spec and counsel.
7. **M12 server hardening:** Sentry scrubbing and the data-deletion checks.

**Lane B (Mobile)**
1. **M5a:** the device database (where the OS backup includes it), pack index, download and sync with mandatory deletion, device registration, and staff preview mode. None of it waits on design.
2. **M5b:** the UI, after the DESIGN mobile rewrite with Ashley: tokens, map home, markers at day and night opacity, the Embark card and route drawing, and the pulsing changed-fragment marker.
3. **M6, then M7, then M8** (after CHRONICLE_SPEC), **then M9 mobile** (after the Journal spec and counsel), **then M12 mobile and the field tests.**

**Docs Claude must have ready ahead of Lane B:** the DESIGN mobile sections (with Ashley) before M5b, CHRONICLE_SPEC before M8, and the Journal spec (with counsel on children's privacy) before M9.

---

## 7. Guardrails

- Nothing reaches `master` without Claude's verification and green CI. Jordan merges; agents never merge.
- Keys and passwords never go in prompts, chat or the repo. Cloud agents aren't used for now: Claude can't push to GitHub, so its review commits need a local agent to carry them.
- Only Lane A touches `supabase/`, so migration timestamps never conflict. Hosted pushes happen only from the main folder on `master`.
- A brief that would make both lanes touch the same files gets split before either lane starts.
- **Cost:** two agents use roughly twice the Cursor usage. Watch the plan's limits.

## 8. Checkpoint

After the first full round (M4 plus M5a), review how often agents sat waiting for review versus waiting on each other, the number of merge conflicts, and the Cursor usage. If reviews keep up and agents idle, consider a third **utility lane** for independent cleanups and tests (never database changes).
