# M3a schema realignment: architect review of the implementation

**Reviewed:** `docs/briefs/M3a-report.md` and branch `m3a-schema-realign` at `43bc76a` (PR #6)
**Verdict:** **APPROVED after two small fixes (F1, F2).** Apply them on this branch, keep everything green, push, and PR #6 can merge. M3b planning can start in parallel (see the end).
**Reviewer:** architect (Claude), 2026-11-20

Strong work. All six required changes (R1–R6) are in, the go-live and failure paths are tested end to end, the definer allowlist is tight and commented, no Story Notes or marker codes appear in the snapshot projection (codes are hashed), and the deviations are reasonable and reported. The spot-check of the migrations turned up one real role leak and one grant to tighten.

---

## Fixes required before merge

### F1. Writers can update any fragment column (role leak)
`fragments_writer_story_notes` (migration 12) is `for update … using has_role(writer, editor, admin)`. RLS can't limit **columns**, so a writer can change location, radius, tier, visibility, teaser, `marker_code` or status on any fragment. The role matrix (DATA_MODEL §13) says writers edit Story Notes and drafts, not groves or fragments.

**Fix:** keep the policy, and add a `before update` trigger on `fragments`. When the caller isn't editor, admin or the service role, it raises `42501` if any column other than `indigeny_earth`, `indigeny_world`, `indigeny_body` and `updated_at` changed (`new is distinct from old` on each). pgTAP, extending `063_rls_story_notes.test.sql`: a writer updating an Indigeny note succeeds; a writer updating `location`, `teaser`, `visibility`, `marker_code` or `status` is refused; an editor can update all of them. Check `threads` and `characters` for the same pattern. Writers may edit their notes and draft fields there, but a character's `status` should change only through a release by an editor, so guard `characters.status` the same way.

### F2. Publish and unpublish only through the edge functions
Migration 13 grants `fn_publish_commit` and `fn_unpublish_commit` to `authenticated` (guarded). The approved plan (§3.4) revoked them: a direct `fn_publish_commit` call skips the copy step of two-phase publish. The builder's self-healing copy hides that today, but it's not the design.

**Fix:** revoke both from `authenticated`; keep them for `service_role` (the `publish` and `unpublish` edge functions already call them with the service client after checking the caller's role). Update `110_definer_grants.test.sql` and its comments, and the `102_publish_unpublish_role_guards` cases: a direct RPC by an editor is now refused at the grant level, and publishing via the edge function still works for an editor and is refused for a writer.

---

## Doc amendment made with this review
**Marker-code visibility (decision, 2026-11-20):** physical-marker codes are printed on public objects, so hiding them from staff below editor adds complexity for no real protection. `docs/briefs/M3-admin.md` now says any staff role may see codes in the admin; they still never reach a pack, a log, Sentry, or a URL other than the printed QR. **No code change is needed** for this: `fragments_staff` exposing `marker_code` to all staff is now correct.

## Accepted as reported
- The 13-migration layout, the collapsed 09–10, and the enum remaps
- Built-in edge runtime for integration on Windows (C5), with `functions serve` optional
- The landcover `null` gate when the grid sha isn't a real digest (fix the seed placeholder whenever the landcover tool lands in M4)
- Seed portraits as deterministic 1×1 PNGs
- `contingencyRevisionNo >= 1` plus before/after comparisons for test isolation
- The no-op `content_sha256` evidence

## Next: M3b planning
After F1 and F2 are pushed, create `m3b-hosted-foundation` from the tip of `m3a-schema-realign` (PR #6 may not have merged yet; rebase onto `origin/master` once it does) and write `docs/briefs/M3b-plan.md` per the M3 brief's plan checkpoint for M3b. **Hosting preconditions status (from JoJo, 2026-11-20):** the hosted Supabase **staging** project exists (Free plan, region us-east-2; production will be us-west-2 later); Vercel is being set up now (Hobby plan, project `intell-admin`, root `apps/admin`); Google Maps keys and SMTP are pending (SMTP will likely be Google Workspace rather than a new provider). Plan around that: list exactly which env vars, dashboard settings and secrets M3b needs and where each one goes, without asking for any values. No keys in the repo or in chat.
