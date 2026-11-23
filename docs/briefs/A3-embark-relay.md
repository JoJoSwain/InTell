# A3 brief (Lane A): the Embark relay

**Lane:** A (Platform) · **Branch:** `a/a3-embark-relay` (in `C:\dev\intell-lanes\a`, cut from `4ed4369`, with this brief committed) · **Plan first:** write `docs/briefs/A3-plan.md`, push, open the PR, and stop for Claude's plan review before writing code.

**What A3 is:** the server side of Embark. The phone sends a grove, a mode and the listener's current position. The `embark` edge function looks up that grove's opening point itself, asks Google's Routes API for a route, and returns it. **The listener's position is never stored or logged anywhere.**

The phone UI (the card, the route line, the slim bar) is Lane B's M5c, which waits on worksheet rows 4.2 and 4.4. M5c builds on this function and its shared schemas.

**Sources:**
- ADR 0005 §5–6
- TECH_SPEC §6 (the `embark` row) and §7 (privacy and secrets)
- PRODUCT_SPEC §5.4, FR-13 and FR-18
- DATA_MODEL §12.3 (the index's `opening`) and the limiter note in §8
- A1's `register-device` (the pattern to follow)

**Lane A never edits `apps/mobile`.**

## Decisions made in this brief
- **D1. Reuse A1's limiter.** Use `fn_device_rate_allow(device_id, 'embark', limit, 86400)` with a default of **60 requests per device per day**. There's no `embark_usage` table; DATA_MODEL and TECH_SPEC are updated in this commit.
- **D2. The destination is the published opening.** It's the opening point of the grove's latest **live** pack build (`pack_builds.opening_lat` / `opening_lng`), the same point phones see in `get_pack_index()`. A grove without a live build or an opening gets 404. The function can only route to groves.
- **D3. The position travels in the POST body only.** Never in the URL or a query string, because infrastructure logs URLs.
- **D4. Only registered devices.** `deviceId` must exist in `devices`; otherwise 403. That's a little friction for abuse. The Google quota cap (Jordan sets it in Google Cloud at deploy) is the real cost backstop.
- **D5. Distance guard.** Refuse an origin more than **150 km** in a straight line from the opening (400). Embark is for getting to a grove nearby.

## Scope

**1. Shared schemas** (`packages/shared/src/schemas/embark.ts`; zod, exported, and synced to `from-shared`):
- **`EmbarkRequest`:** `{ deviceId: uuid, groveId: uuid, mode: "walk" | "bike" | "transit", origin: { lat, lng } }`, with lat/lng range checks. **No other mode parses**, and `drive` fails.
- **`EmbarkResponse`:** `{ mode, distanceM, durationS, polyline, steps?, warnings }`.
  - `polyline` is Google's encoded polyline for the whole route.
  - `steps` (transit only) holds the walk and transit legs, each with its own encoded polyline, distance and duration. Transit legs also carry the line (name, short name, color, text color, vehicle type), the departure and arrival stop names and times, and the stop count.
  - `warnings` is Google's route warnings, passed through as given. Google requires showing them, for example the walking and cycling beta notice.
- Keep the response small: only what M5c draws and shows.

**2. The `embark` edge function** (`supabase/functions/embark/`):
- **Caller and body:** a publishable-key caller (`requirePublishableCaller`, `verify_jwt = false` in `config.toml`, like `register-device`). POST only, with the body parsed by `EmbarkRequest`.
- **Order of checks:** body → registered device (D4) → rate limit (D1, 429) → opening lookup (D2, 404) → distance guard (D5, 400) → Google.
- **The Google call:** Routes API `computeRoutes` with `travelMode` `WALK`, `BICYCLE` or `TRANSIT`. There is **never** a `DRIVE` (and no `TWO_WHEELER`).
  - A minimal `X-Goog-FieldMask`.
  - Metric units.
  - The key from the function secret `GOOGLE_ROUTES_API_KEY`.
  - The base URL overridable by an env var, for the CI stub.
- **Errors:**
  - Google errors and timeouts give `502 { error: "route unavailable" }`. Never echo Google's error body.
  - No route gives `404 { error: "no route" }`.
- **Logging** follows `register-device`: the device prefix (8 characters) plus an outcome word (`ok`, `rate-limited`, `no-route`, `upstream-error`) and the mode.
  - **Never** log the origin, the grove id, the route or Google's request or response.
- **Structure:** a pure handler (`handleEmbark(deps)`) with injected `fetch`, database calls and logger, so tests can assert exactly what was sent and logged. The `index.ts` file just wires it up.

**3. Tests:**
- **Handler unit tests:**
  - each mode sends the right `travelMode` and field mask
  - `drive` and unknown modes are refused before any call
  - unregistered device → 403
  - rate limit → 429
  - no live build or no opening → 404
  - over 150 km → 400
  - Google 500 or timeout → 502 without its body
  - transit steps map correctly from a recorded fixture
  - **the logger never receives the origin's numbers, the grove id or the polyline** (assert on every logged string)
- **Integration test** (`tools/pack-integration`, as for `register-device`): against the local stack, with Google stubbed by a local HTTP stub through the base-URL env var. One happy path per mode, plus the 429 path.
- **pgTAP:** only if a migration is needed (D1 should need none).

**4. Docs:** a short note in `supabase/README` (or the runbook) naming the secret and the Google-side quota. **Names only**, never values.

## Accept when
- [ ] `pnpm lint`, `typecheck`, `test`, `db:check-edge-shared` and the `db` job pass.
- [ ] The handler tests above pass, including the "never logs the origin" assertions.
- [ ] The integration test passes in CI with Google stubbed. No real key is in the repo or CI.
- [ ] No route goes to anything but a grove's published opening, and no mode other than walk, bike or transit exists anywhere in the code.

## Out of scope
- The phone UI (M5c)
- Creating the Google key and setting the secret on staging (Claude walks Jordan through that after merge)
- M4b

## Plan (stop after this)
`docs/briefs/A3-plan.md` should cover:
- **The exact schemas,** and the Routes API request with its field mask, citing Google's current docs.
- **How transit steps map** into the response.
- **The handler's structure and dependencies.**
- **How the opening is looked up** (the SQL or RPC).
- **The test list,** and how the stub works locally and in CI.
- **Anything in Google's terms** that the phone must honor in M5c (warnings, attribution) and that the response should carry.
- **Spec gaps.**

Push with `git push -u origin a/a3-embark-relay`, open a PR titled "A3: Embark relay (plan)", and **stop for plan review.**
