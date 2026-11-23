# A3 plan review (Lane A): the Embark relay

**Tip reviewed:** `2dff64d` · **Brief:** `docs/briefs/A3-embark-relay.md`

## Verdict

**Approved. Build it as planned, with R1–R2.**

The plan gets the important things right:
- **The checks run in the brief's order.**
- **The Google side is right:** the field masks are minimal and cite Google's docs, `DRIVE` can't be reached, and Google's error bodies never get through.
- **The opening comes from the live build,** the same point the phone sees in the index.
- **The handler is pure,** with injected dependencies, so the "never logs the origin" assertions are real tests.

## Required changes

**R1. Missing transit details never fail the route.**
- **The problem:** transit data varies by agency, and Google sometimes omits a stop name, a time or a stop count. Failing the whole route with a 502 for that would be bad for a listener standing at a bus stop.
- **The fix:** make `departureStop`, `arrivalStop`, `departureTime`, `arrivalTime` and `stopCount` **optional** in `EmbarkStep`, and keep the step. Drop a step only when it has no polyline, as planned.
- **When to 502:** only when the route itself is unusable, meaning no top-level polyline, distance or duration.
- **Test:** a transit fixture with a missing stop name.

**R2. No request details in errors or logs.**
- **Invalid bodies:** return `400 { error: "invalid body" }` and log `invalid-body`. Never include zod's issue list, because issues can carry the values that failed.
- **A top-level try/catch** in `index.ts` returns `500 { error: "internal" }` and logs `internal-error` with the device prefix only. It never logs the error message or stack, which could include request data.
- **Test:** each of these.

## Notes (no answer needed)
- **N1. Language.** Add an optional `lang` (a BCP-47 code, default `"en"`) to `EmbarkRequest`, and send it as `languageCode`. Then Google's warnings and stop names arrive in the listener's language when M5c passes the device language.
- **N2. Unit tests in Vitest,** importing the pure modules as `pageSnapshots` does. Yes.
- **N3. Passing the stub's settings to `supabase functions serve`** in the `db` job: use a generated `--env-file`, never a committed one.

## Answers to the spec gaps
1. **TECH_SPEC's `embark` row:** updated in this commit to `{mode, distanceM, durationS, polyline, steps?, warnings}`.
2. **The beta notice: confirmed.** M5c shows Google's `warnings` **and** ADR 0005's gentle walk and bike note. The relay invents no copy.
3. **Distinct 404 phrases** (`no opening` and `no route`): **accepted.** M5c decides whether they share a message.
4. **Reaching 429 by calling the RPC directly:** **accepted.** No production env override.
5. **A build with null opening coordinates means no opening:** **accepted.**

## Next
1. Push this review.
2. Build A3 in the plan's order, with R1–R2 (and N1).
3. Write `docs/briefs/A3-report.md`, starting with `Lane A · A3`. Cover:
   - the test list with results
   - the CI run, including the stub
   - one example response per mode, from the stub
   - `git log --oneline origin/master..HEAD`
   - any deviations
4. Retitle the PR "A3: Embark relay", and stop for implementation review.
