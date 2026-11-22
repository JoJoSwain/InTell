# S0A report — CI runs once per PR

Lane A · S0A

**Branch:** `a/s0-setup` (`C:\dev\intell-lanes\a`)
**PR:** https://github.com/JoJoSwain/InTell/pull/18
**CI change:** `61ffc9a`
**Brief:** `docs/briefs/S0A-ci-once-per-pr.md`
**Stop for review.** Did not reset the local database. Did not start M4.

---

## Diff to `.github/workflows/ci.yml`

```diff
 on:
   push:
-    branches: ["**"]
+    branches: [master]
   pull_request:

-# Push + pull_request both fire for PR branches; cancel the older run so two
-# supabase stacks never race on the same runner's fixed host ports (54324…).
+# One group per PR (pull_request.number) and per branch for master pushes.
+# A newer push cancels the in-progress run so two supabase stacks never race
+# on the same runner's fixed host ports (54324…).
 concurrency:
-  group: ci-${{ github.workflow }}-${{ github.ref }}
+  group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
   cancel-in-progress: true
```

Job names `check` and `db` are unchanged. Nothing else in the workflow changed.

## Checks

Push `61ffc9a` produced one workflow run, event `pull_request`, conclusion success. That run has one `check` job and one `db` job. There is no `push` run for that SHA.

- Checks list: https://github.com/JoJoSwain/InTell/pull/18/checks
- Run: https://github.com/JoJoSwain/InTell/actions/runs/45060383439
- `check` pass (1m3s): https://github.com/JoJoSwain/InTell/actions/runs/45060383439/job/137324738044
- `db` pass (5m44s): https://github.com/JoJoSwain/InTell/actions/runs/45060383439/job/137324738206
- Vercel pass: https://vercel.com/replaceplace/intell-admin/BwHHcqQJHde6gPzs7A7z4pV58DqJ

## Local checks

`pnpm lint`, `pnpm typecheck`, and `pnpm test` passed. No local database suite (CI-only change).

## `git log --oneline origin/master..HEAD`

```
61ffc9a ci: run the suite once per pull request (S0A)
a109543 docs: S0A brief (Lane A: CI runs once per PR)
4fc886e docs: two-lane workflow, lanes rule, M3h R2 verification
```

The log above is from before this report commit.
