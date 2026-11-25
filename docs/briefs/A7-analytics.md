# A7 brief (Lane A): audio constant cleanup, then M11 analytics

**Lane:** A (Platform) · **Branch:** `a/a7-analytics`, cut from `master` at `e03d662`. This brief is its first commit. · **Plan first** for Part 2 (M11). Part 1 is small and needs no plan.

## Part 1: the cleanup (first commit after the brief)
Both audio branches have now merged, so unify the duplicated one-shot look-ahead settings:
- Make B·S2's `ONESHOT_LOOKAHEAD_SEC` / `ONESHOT_MAX_PENDING` (in `oneshotSchedule.ts`) the single source.
- Point the AudioDirector at them, and remove `DIRECTOR_ACCENT_LOOKAHEAD_SEC` / `DIRECTOR_ACCENT_MAX_PENDING`. Keep a deprecated alias only if something outside `packages/shared` imports them.
- All tests stay green, with no behaviour change.

Also check whether the director should count voices with B·S2's `VoiceLedger`. If so, propose it in the plan. Don't change it in Part 1.

**Lane A never edits `apps/mobile`.** If the cleanup touches a mobile import, flag it for Lane B instead.

## Part 2: M11, analytics and the dashboard
**Sources:**
- BUILD_PLAN M11
- TECH_SPEC §8 (the telemetry events, with zod schemas in `packages/shared/src/schemas/events.ts`) and §9 (the dashboard: SQL views, America/Denver months)
- DATA_MODEL (the device tables, the deletion rules)
- PRODUCT_SPEC (privacy)
- the A4 session's `analytics` effects

**Build:**
1. **The event schemas:** every event in TECH_SPEC §8, as zod in shared, versioned.
   - **Privacy:** no coordinates, no marker codes, no free text from listeners, and `device_id` as the only identifier.
   - Check the A4 session's analytics names and props against them, and flag any mismatch.
2. **`ingest-events`, an edge function:**
   - It takes batched events from registered devices.
   - It validates them with zod and drops anything unknown.
   - It's rate-limited with `fn_device_rate_allow`, and idempotent on a per-event id.
   - It stores events in an events table with RLS (no access for `anon`).
3. **The phone's event queue: shared logic only.** That's the batching, the retry and backoff, and capping the queue. Lane B wires it in M6/M7. Lane A doesn't edit `apps/mobile`.
4. **Dashboard:**
   - The SQL views from TECH_SPEC §9, including the contribution-return comparison, in America/Denver months.
   - Admin pages with charts, tables and CSV export.
   - Staff only, with admin-only pages where TECH_SPEC says so.
5. **`delete-device-data`:** removes every server row and voice file for a device, verified by a test. **`export-archive`,** as TECH_SPEC describes.

**Tests:**
- Dashboard numbers match a fixture dataset, including the contribution-return comparison (BUILD_PLAN M11).
- Delete removes everything for the device.
- Ingest validation, the rate limit and idempotency.
- pgTAP for RLS and grants.

**Accept when:**
- [ ] `pnpm lint`, `typecheck` and `test` pass, and both CI jobs are green.
- [ ] The BUILD_PLAN M11 acceptance items pass.
- [ ] No coordinates or listener text are stored.
- [ ] No database reset happens without asking Jordan.

## Plan (stop after Part 1's commit and the plan)
`docs/briefs/A7-plan.md` covers:
- the event list mapped to the zod schemas
- the ingest design (auth, the rate limit, idempotency, storage)
- the views and dashboard pages
- the deletion and export design
- the shared queue logic
- the fixture dataset
- the order of work
- spec gaps (flag them; don't guess)

Push with `git push -u origin a/a7-analytics`, open a PR titled "A7: cleanup + M11 analytics (plan)", and **stop for plan review.**
