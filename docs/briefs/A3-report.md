# Lane A · A3

**Branch:** `a/a3-embark-relay` · **PR:** retitled "A3: Embark relay"  
**Brief:** `docs/briefs/A3-embark-relay.md` · **Plan / review:** `A3-plan.md`, `A3-plan-review.md` (R1–R2, N1)

## What shipped

- Shared zod: `packages/shared/src/schemas/embark.ts` (`EmbarkRequest` / `EmbarkResponse` / steps), synced to `from-shared`.
- Edge function `supabase/functions/embark/` — pure `handleEmbark`, Google mapping, live opening lookup, `verify_jwt = false` + publishable caller.
- R1: transit stop fields optional; never 502 for missing agency details.
- R2: `400 { error: "invalid body" }` with no zod issues; unexpected failures → `500 { error: "internal" }` with no error text in logs.
- N1: optional `lang` (default `en`) → Google `languageCode`.
- Stub `tools/routes-stub.mjs`; CI `db` job starts it and passes a generated `--env-file` with `GOOGLE_ROUTES_BASE_URL=http://host.docker.internal:8791` (edge runtime is in Docker).
- `supabase/README.md` names `GOOGLE_ROUTES_API_KEY` and the quota note only.

## Test list

| Area | Result |
|---|---|
| Handler / mapping unit (`embark.unit.test.ts`) — modes, masks, drive refuse, 403/429/404/400, Google 500/timeout → 502, empty routes, transit + missing stop name (R1), invalid body / internal without details (R2), logger never sees origin / grove id / polyline | **PASS** (13) |
| Integration — walk / bike / transit happy path vs stub | **PASS** |
| Integration — 429 after exhausting window via RPC | **PASS** |
| Integration — missing key 401 / secret key 403 | **PASS** |
| `pnpm lint` / `typecheck` / `test` / `db:check-edge-shared` | **PASS** |

Local database was **not** reset for this milestone (existing stack + seed used for integration).

## CI / stub

- Stub: `node tools/routes-stub.mjs` on host port **8791**.
- Functions serve gets a **generated** env file (not committed): base URL `http://host.docker.internal:8791`, dummy API key.
- Wired the same way in `.github/workflows/ci.yml` `db` job. No real Google key in the repo or CI.

## Example responses (from the stub)

**walk**
```json
{
  "mode": "walk",
  "distanceM": 2400,
  "durationS": 1200,
  "polyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  "warnings": ["Walking routes are in beta and may sometimes be missing clear sidewalks."]
}
```

**bike**
```json
{
  "mode": "bike",
  "distanceM": 2800,
  "durationS": 600,
  "polyline": "a~l~Fjk~uOwHJy@P",
  "warnings": ["Bicycling routes are in beta and may sometimes be missing clear paths."]
}
```

**transit** (steps abbreviated)
```json
{
  "mode": "transit",
  "distanceM": 5000,
  "durationS": 1800,
  "polyline": "zzz~F|def@",
  "warnings": [],
  "steps": [
    { "kind": "walk", "distanceM": 200, "durationS": 180, "polyline": "wxy~F|abc@" },
    {
      "kind": "transit",
      "distanceM": 4800,
      "durationS": 1620,
      "polyline": "zzz~F|def@",
      "line": {
        "name": "FrontRunner",
        "nameShort": "FR",
        "color": "#0055A5",
        "textColor": "#FFFFFF",
        "vehicleType": "COMMUTER_TRAIN"
      },
      "departureStop": "Farmington Station",
      "arrivalStop": "Refuge Gate",
      "departureTime": "2026-11-23T18:00:00Z",
      "arrivalTime": "2026-11-23T18:27:00Z",
      "stopCount": 4
    }
  ]
}
```

## `git log --oneline origin/master..HEAD`

```
68ba63a feat: embark relay with Routes stub, R1–R2 and optional lang.
399eec1 docs: A3 plan review (R1 optional transit details, R2 no request details in errors or logs); TECH_SPEC embark response
2dff64d docs: A3 Embark relay plan for plan review.
ddb1d94 docs: specs follow ADR 0006 and A2; A3 (Embark relay) and B-S1 (audio protocol) briefs; roadmap
```

## Deviations

- Stub base URL for the edge runtime is `host.docker.internal`, not `127.0.0.1` — required because functions run in Docker while the stub listens on the host. Documented in README and CI.
- `deviceExists` / opening failures that throw are returned as `500 internal` from the handler (in addition to `index.ts`’s top-level try/catch), so R2 is covered by unit tests without Deno.serve.
