# A3 plan — Embark relay

Lane A · A3. Plan only. No module code in this commit.

The phone UI is Lane B's M5c. This plan is the `embark` edge function, shared zod schemas, tests and a short secrets note. Lane A does not edit `apps/mobile`.

Out of scope: creating the Google key on staging (Claude walks Jordan through that after merge), M4b, M5c.

Sources cited: ADR 0005 §5–6, TECH_SPEC §6–7, PRODUCT_SPEC §5.4 / FR-13 / FR-18, DATA_MODEL §8 / §12.3, A1 `register-device`, and Google's Routes API docs ([computeRoutes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes), [transit routes](https://developers.google.com/maps/documentation/routes/transit-route), [travel modes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteTravelMode)).

---

## Schemas

`packages/shared/src/schemas/embark.ts`, exported from `@intell/shared`, and added to `tools/sync-edge-shared.mjs` → `from-shared/embark.ts`.

Uuid v4 matches A1's device schema (strict regex, not a loose uuid).

```ts
const LatLng = z
  .object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
  })
  .strict();

export const EmbarkMode = z.enum(["walk", "bike", "transit"]);
// drive / TWO_WHEELER / anything else fails zod before Google is called.

export const EmbarkRequest = z
  .object({
    deviceId: UuidV4,
    groveId: UuidV4,
    mode: EmbarkMode,
    origin: LatLng,
  })
  .strict();

export const EmbarkTransitLine = z
  .object({
    name: z.string().optional(),
    nameShort: z.string().optional(),
    color: z.string().optional(),
    textColor: z.string().optional(),
    vehicleType: z.string().optional(), // Google's Vehicle.type, e.g. BUS, SUBWAY
  })
  .strict();

export const EmbarkStep = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("walk"),
      distanceM: z.number().nonnegative(),
      durationS: z.number().nonnegative(),
      polyline: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("transit"),
      distanceM: z.number().nonnegative(),
      durationS: z.number().nonnegative(),
      polyline: z.string().min(1),
      line: EmbarkTransitLine,
      departureStop: z.string().min(1),
      arrivalStop: z.string().min(1),
      departureTime: z.string().min(1), // RFC3339 from Google
      arrivalTime: z.string().min(1),
      stopCount: z.number().int().nonnegative(),
    })
    .strict(),
]);

export const EmbarkResponse = z
  .object({
    mode: EmbarkMode,
    distanceM: z.number().nonnegative(),
    durationS: z.number().nonnegative(),
    polyline: z.string().min(1),
    steps: z.array(EmbarkStep).optional(), // transit only
    warnings: z.array(z.string()), // always present; may be []
  })
  .strict();
```

`warnings` is always an array (empty when Google sends none). M5c shows every string. That replaces the older TECH_SPEC names `transitSteps` / `betaNotice` (see Spec gaps).

---

## Routes API request

**URL:** `POST {GOOGLE_ROUTES_BASE_URL}/directions/v2:computeRoutes`  
Default base: `https://routes.googleapis.com`. Overridable for the CI/local stub (no trailing slash).

**Headers:**
- `Content-Type: application/json`
- `X-Goog-Api-Key: {GOOGLE_ROUTES_API_KEY}`
- `X-Goog-FieldMask:` (mode-dependent, below)

**Body (all modes):**

```json
{
  "origin": { "location": { "latLng": { "latitude": <origin.lat>, "longitude": <origin.lng> } } },
  "destination": { "location": { "latLng": { "latitude": <opening.lat>, "longitude": <opening.lng> } } },
  "travelMode": "WALK" | "BICYCLE" | "TRANSIT",
  "units": "METRIC"
}
```

Mode map: `walk` → `WALK`, `bike` → `BICYCLE`, `transit` → `TRANSIT`. Never `DRIVE` or `TWO_WHEELER`. No intermediate waypoints (transit forbids them). No `routingPreference` for walk/bike (traffic prefs are drive-oriented). Transit leaves Google's default departure time (`now`).

**Field masks** (minimal; Google requires a mask and discourages `*` / top-level `routes`):

| Mode | `X-Goog-FieldMask` |
|---|---|
| walk, bike | `routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.warnings` |
| transit | the walk/bike mask, plus `routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.travelMode,routes.legs.steps.transitDetails` |

`routes.duration` is a protobuf Duration JSON string (e.g. `"1234s"`). Parse to integer seconds for `durationS` (floor; reject or 502 if missing/unparseable). `routes.distanceMeters` → `distanceM`. First route only (`routes[0]`); empty `routes` → 404 `no route`.

Timeout: AbortSignal ~10 s. Google HTTP ≥400, network error or timeout → 502 `{ error: "route unavailable" }` with **no** Google body in the response or logs.

---

## Transit step mapping

Take `routes[0].legs` in order. For each `step` whose `travelMode` is `WALK` or `TRANSIT`, append one `EmbarkStep`. Skip other modes if they appear. Steps without a polyline are dropped (cannot draw).

| Google step | EmbarkStep |
|---|---|
| `travelMode: "WALK"` | `{ kind: "walk", distanceM, durationS from staticDuration, polyline }` |
| `travelMode: "TRANSIT"` + `transitDetails` | `{ kind: "transit", distanceM, durationS, polyline, line: { name, nameShort, color, textColor, vehicleType: vehicle.type }, departureStop: stopDetails.departureStop.name, arrivalStop: stopDetails.arrivalStop.name, departureTime / arrivalTime from stopDetails, stopCount }` |

Missing required transit fields (stop names, times, stopCount) → treat as upstream failure (502), not a partial step. Walk/bike responses omit `steps`.

`warnings` = `routes[0].warnings ?? []` (pass through; do not invent copy).

---

## Handler structure

```
supabase/functions/embark/
  index.ts      // Deno.serve: method, requirePublishableCaller, parse body, wire deps, call handleEmbark
  handler.ts    // pure handleEmbark(req, deps) → Response
  google.ts     // buildComputeRoutesRequest, mapComputeRoutesResponse, parseDurationS
  opening.ts    // lookupLiveOpening(supabase, groveId)
```

**`handleEmbark` deps (injected for tests):**

```ts
type EmbarkDeps = {
  fetch: typeof fetch;
  deviceExists: (deviceId: string) => Promise<boolean>;
  rateAllow: (deviceId: string) => Promise<boolean>; // wraps fn_device_rate_allow
  lookupOpening: (groveId: string) => Promise<{ lat: number; lng: number } | null>;
  routesBaseUrl: string;
  routesApiKey: string;
  log: (deviceId: string, outcome: string, mode?: string) => void;
  // distanceMeters from from-shared/polygon.ts (already synced)
};
```

**Check order (brief):** body parse → registered device (D4, 403) → rate limit (D1, 429) → opening (D2, 404) → distance guard (D5, 400) → Google.

Constants: endpoint `'embark'`, limit **60**, window **86400**. Distance max **150_000** m via `distanceMeters(origin, opening)`.

**Logging** (A1 pattern): `embark {outcome} device={8-char} mode={mode?}`. Outcomes: `ok`, `unregistered`, `rate-limited`, `no-opening`, `too-far`, `no-route`, `upstream-error`, plus wire errors (`invalid-body`, `rate-limit-error`). **Never** interpolate origin lat/lng, groveId, polyline, Google request/response, or the full device id. Unit tests assert every logged string.

**config.toml:** `[functions.embark] verify_jwt = false`, same comment class as `register-device`. `requirePublishableCaller` refuses missing (401) and secret / lone JWT (403).

---

## Opening lookup

No new RPC or migration (D1). Service-role client:

```sql
select opening_lat, opening_lng
  from pack_builds
 where scope = 'grove'
   and scope_id = $groveId
   and live = true
   and opening_lat is not null
   and opening_lng is not null
 order by id desc
 limit 1;
```

(PostgREST: `.from("pack_builds").select(...).eq(...).eq("live", true).not("opening_lat", "is", null).order("id", { ascending: false }).limit(1).maybeSingle()`.)

Null / missing row → 404 `{ error: "no opening" }` (or `"not found"` — one fixed phrase, chosen in code). The function never accepts a free destination; only this grove opening.

Device check: `.from("devices").select("id").eq("id", deviceId).maybeSingle()`; absent → 403.

---

## Tests and stub

### Handler unit tests (`supabase/functions/embark/` via Deno or a small Vitest harness that imports the pure modules)

The pure modules stay Deno-safe TypeScript without `Deno.*` so Vitest in `tools/pack-integration` (or a dedicated folder) can import them the same way `pageSnapshots` is tested. Prefer that over Deno.test if CI already runs Vitest for edge helpers.

Cases from the brief:

1. Each mode sends the right `travelMode` and field mask (assert on `fetch` call URL, headers, body).
2. `drive` / unknown mode → 400 before any fetch / DB.
3. Unregistered device → 403; rate limit false → 429; no opening → 404; over 150 km → 400.
4. Google 500 / timeout / AbortError → 502; response and logs contain no Google body.
5. Empty `routes` → 404 `no route`.
6. Transit fixture → steps match the mapping table.
7. **Logger:** every logged string is free of origin digits that match the fixture lat/lng, free of the grove UUID, and free of the polyline text.

### Integration (`tools/pack-integration`)

Against local Supabase + `functions serve`, with Google stubbed:

- Happy path walk, bike, transit (seed Farmington opening; stub returns a recorded body per mode).
- 429 after exhausting the daily window (or temporarily lower limit via an env override used only in tests — prefer calling `fn_device_rate_allow` until false, then one embark call).
- Publishable-key refusals mirror register-device (missing / secret).

### Stub

A tiny Node HTTP server (e.g. `tools/pack-integration/src/routesStub.ts` or `tools/routes-stub.mjs`) that:

- Listens on a fixed local port.
- Accepts `POST /directions/v2:computeRoutes`.
- Records the last request (for assertions).
- Returns fixture JSON by `travelMode`.

**CI / local wiring:** before `supabase functions serve`, set:

- `GOOGLE_ROUTES_BASE_URL=http://127.0.0.1:<stub-port>`
- `GOOGLE_ROUTES_API_KEY=test-not-a-real-key`

Pass them into `functions serve` (env file or process env). Update the `db` job in `.github/workflows/ci.yml` to start the stub, then serve. No real key in the repo or CI secrets for A3. Document the secret **name** only in `supabase/README.md` (create a short file; none exists today) plus the Google Cloud daily quota note.

### pgTAP

None unless implementation discovers a need. D1 reuses `fn_device_rate_allow`.

---

## What M5c must honor (Google + ADR 0005)

Carry in the response and document for Lane B:

1. **`warnings`:** show every string Google returns (`routes.warnings`). Google requires displaying them when showing the route.
2. **Walk / bike beta notice:** Google's [RouteTravelMode](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteTravelMode) note: WALK and BICYCLE are beta and may lack clear paths; **you must display a warning** for every walking or bicycling route shown. ADR 0005 §5 already wants a short, gentle note on those cards. That obligation is on the phone even when `warnings` is `[]` — product copy, not invented by the relay.
3. **Maps attribution:** M5c draws the polyline on the Google Maps SDK map, which already provides platform attribution. Do not strip it. No extra attribution string is added to `EmbarkResponse`.
4. **No spoken turn-by-turn** (ADR 0005 / PRODUCT_SPEC). The relay does not return navigation instructions; field masks omit `navigationInstruction`.

---

## Order of work

1. Shared schemas + export + `sync-edge-shared` / `check-edge-shared`.
2. `google.ts` mapping + fixtures + unit tests (no network).
3. `handler.ts` + `opening.ts` + `index.ts` + `config.toml`.
4. Routes stub + CI/local env wiring + integration tests.
5. Short `supabase/README.md` note (secret name + quota).
6. `pnpm lint`, `typecheck`, `test`, `db:check-edge-shared`; integration in CI.

---

## Spec gaps

1. **TECH_SPEC §6 `embark` row** still says `{mode, distanceM, durationS, polyline, transitSteps?, betaNotice?}`. The brief (and this plan) use `steps?` and `warnings`. After A3 merges, Claude should align TECH_SPEC to the shipped shape (Lane A does not edit `docs/**` specs).
2. **Beta notice vs `warnings`:** Google's required walk/bike beta text is a developer obligation and may not appear in `routes.warnings`. The relay only passes Google's array; M5c still shows ADR 0005's gentle note for walk/bike. Confirm in M5c brief that both surfaces appear (Google warnings + product beta note), without the relay inventing copy.
3. **404 phrasing:** brief says 404 for no live build / no opening and separately 404 for no route. Plan uses distinct error strings (`no opening` vs `no route`) so clients and tests can tell them apart; confirm if the phone should treat both as the same UX.
4. **Rate-limit env override:** integration may need a way to hit 429 without 60 real calls. Prefer exhausting the window with direct RPC hits rather than a production env override; flag if CI time becomes an issue.
5. **Opening when pack exists but both lat/lng null:** treated as no opening (404). Matches "phones see opening in the index only when set."
