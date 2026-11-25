# A7 checkpoint review (Claude): plan §7 steps 1–4

**Verdict:** accepted. Make the two small fixes below, then continue with steps 5–10.

What's good:
- The §8 schemas are strict per event name, and the envelope allows only primitive props.
- `v` / `EVENT_SCHEMA_VERSION` are in place.
- A4 now emits `{ name, props, refs }`, including `fragment_triggered`, `fragment_completed` (with `time_window` / `change_kind`) and `fragment_unlocked`.
- `ingest-events`:
  - checks the envelope, then that the device exists, then the rate limit
  - soft-drops bad events with a reason
  - upserts idempotently with `DO NOTHING`
  - logs at most 8 characters of the `device_id`
- The `schema_version` migration and pgTAP 130 are in.
- The queue follows G12/G13.
- CI is green.

## Fixes
1. **A database error isn't "not registered".** `deviceExists` returns `false` when the query fails, so the phone would get a 404, register again, and retry for nothing. Make it return `"error"` on failure, and have the handler answer `500`. Add a unit test.
2. **Merge master.** The branch merged `a/a7b-device-parsers` directly. PR #38 is now on master (`058e85b`), so merge `origin/master` into `a/a7-analytics` with a merge commit; there's no content difference. That keeps the history on master's line.

## Next
Steps 5–10 per the plan and `A7-plan-review.md`:
- the views, with `security_invoker` and grants
- the fixture, with the expected numbers written out by hand
- the dashboard and CSV
- `delete-device-data`
- `export-archive` (G10 scope)

Stop when everything is done. `pnpm lint` (for the packages you touched), `typecheck` and `test` must pass, and both CI jobs must be green. No database reset without Jordan. Nothing aimed at staging.
