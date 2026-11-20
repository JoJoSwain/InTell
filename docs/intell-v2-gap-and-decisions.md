# InTell — Gap vs v0 Demo, Ambiguities & Next Steps (v2)

> **Historical (v2).** Superseded by ADR 0004 (2026-11-20) and the v3 specs. Kept for context only.

**Audience:** JoJo  
**Date:** 2026-11-19  
**Companion:** [`intell-v2-architecture.md`](./intell-v2-architecture.md)  
**Inputs:** `docs/*` specs, preferences, v0 demo (`apps/intell`, PR #1), prior product description  

---

## 1. Headline rethink findings (10)

1. **Map-home replaces browse/list IA.** PRODUCT principle #1 forbids feeds, search, and nearby lists. The v0 Expo demo’s Home → Search → Browse regions → Place list is the wrong product chrome — keep only as a historical spike.
2. **Grove / fragment tree supersedes Place → Route → Stop.** Content is a polygon + Root/Branch/Leaf unlock tree, not a linear route playlist. Sequential “mock path” demos must become GPX + unlock/trigger shared logic.
3. **Three audio layers + Hush are load-bearing.** v0 played single-file narration only. Without Surroundings, Soundtrack, ducking, and Hush, the experience is not InTell.
4. **Journal and Grow are half the product.** Memory (Echo rules, tree/storybook) and participation (seeds, Rings, Crossroads, Ledger) are not “phase 2 nice-to-haves” — they are in v1 scope (M8–M10).
5. **Packs are the delivery system; Postgres is authoring.** v0 bundled JSON in the app. v2 requires signed/versioned grove + region packs from Supabase Storage with revocation-by-delete-on-sync.
6. **Anonymous device model, not guest-browsing chrome.** Same “no account wall” instinct as v0, but formalized: `device_id`, age gate, attestation for votes, Journal local-only, location never uploaded.
7. **Shared pure logic + Listening Simulator is the architecture spine.** Unlock/trigger/ambience/music/hush must live in `packages/shared` and drive both mobile and admin Simulator — v0 had no shared package or admin.
8. **Monorepo is non-negotiable.** TECH_SPEC: `apps/mobile`, `apps/admin`, `packages/shared`, `supabase/`, `tools/`. Extending `apps/intell` alone will fight every later milestone.
9. **Rights/playability are runtime.** Consent revocation must rebuild packs and purge phones. v0 checksum strings were cosmetic; M2 is the real contract.
10. **Preferences region-browse default is superseded.** Spec authority preference (2026-11-19) + PRODUCT win: CMS region drill-down is out of listener IA. Regions remain **data** for packs/landcover/admin, not a Browse screen.

---

## 2. What the v0 demo got right (keep the learning)

| Learning | Carry forward |
| --- | --- |
| First-party Expo client, not a borrowed tour host | Locked preference; TECH_SPEC confirms Expo |
| Multi-geography content possible without app rebuild | Aligns with packs + any-site Grove model |
| Guest / no account wall | Maps to anonymous `device_id` |
| Offline pack install UX (download → block start if missing) | Becomes grove/region pack download on map Grove sheet |
| Dwell / silence > wrong story instinct | Evolve into FR-3 two-fix trigger + unlock gates + Hush |
| Credits + place-specific transcript language | Expands to revision credits, Ledger, community sounds |
| Separating canonical content from client | Evolve `content/` → pack manifests produced by `build-pack` |
| Engine unit tests for geofence logic | Pattern for `packages/shared` Vitest suites |

**PR #1** should remain open as a **spike / historical demo**, not the base for M5–M7. Prefer a **fresh branch from `master`** for M0 (or stack docs PR then M0), preserving PR #1 history.

---

## 3. What must be discarded or redesigned

| v0 / prior assumption | v2 requirement | Action |
| --- | --- | --- |
| Nearby / Search / Browse regions home | Map home + 3 sub-screens | Do not port screens |
| Place → Prep → linear Route segments | Grove enter → exploring session; fragment tree | New session machine |
| Mock path autoplay of all segments in path order | Unlock + trigger + tier priority; GPX E2E later | Redesign; sequential-only gate was a band-aid |
| Single WAV narration player (`expo-av`) | `AudioEngine` multi-bus (M1 spike) | Replace |
| No ambience / music / Hush | Full AUDIO_SPEC | Build M4/M7 |
| No Journal / Grow | JOURNAL + PARTICIPATION | M8–M10 |
| Bundled seed JSON as “CMS later” | Supabase authoring + pack pipeline | M2+ |
| Flat `apps/intell` app | Monorepo mobile/admin/shared | M0 |
| Region browse as product feature (preferences old default) | Region as backend/geo concept only | Drop from IA |
| “Accessible play from list” as primary GPS fallback | Accessible play setting + tap-in-range + QR | Spec’d differently |

---

## 4. Open ambiguities (real gaps) + recommended defaults

PRODUCT_SPEC §9 says the product owner decides some items. Preferences say assume best defaults and settle in testing. Recommendations below are **defaults to proceed**, not silent law — JoJo can override.

| # | Ambiguity | Spec pointer | Recommended default | Blocks |
| --- | --- | --- | --- | --- |
| A1 | Store name / bundle ID / link domain | PRODUCT §9.1 | Keep placeholders: “InTell by Replaceplace”, `org.replaceplace.intell`, `intell.replaceplace.org` | Store submit (M12); universal links earlier |
| A2 | Map tiles: MapTiler vs self-hosted PMTiles | PRODUCT §9.2, TECH | **Defer decision to start of M5**; M0–M4 use a free/dev style URL stub. Prefer **Protomaps PMTiles** if cost/control matters for offline; MapTiler if speed-to-ship wins. | M5 |
| A3 | Brand animation (Lottie/Rive) | PRODUCT §9.3, DESIGN §1.5 | **Placeholder wordmark fade** until brand file arrives | M5 polish / M12 |
| A4 | Ring cadence / staff hours | PRODUCT §9.4 | **2 Rings / Grove / Year 1** as recommended | Content ops, not code |
| A5 | Seed triage owner / 14-day SLA | PRODUCT §9.5 | Founders + volunteer writers; **14-day Read target** as metric, not hard blocker | Ops |
| A6 | Spanish at launch | PRODUCT §9.6 | **UI i18n scaffolding (en+es keys) from M5**; narration es only when content exists | M5 strings |
| A7 | Accessible play default | PRODUCT §9.7 | **Off by default** (preserves place-gating); discoverable in Settings | M6 |
| A8 | Sound seeds in v1 | PRODUCT §9.8 | **In v1** per PARTICIPATION phasing (sound → ambience) | M9 |
| A9 | Audio engine library | PRODUCT §9.9, AUDIO §2.2 | **Spike `react-native-audio-api` in M1**; Expo Module fallback if fail | M1 |
| A10 | Repo layout: `intell/` root vs Replaceplace root | TECH §2 shows `intell/` | **Use Replaceplace repo root** with `apps/mobile`, `apps/admin`, `packages/shared` — avoid nested extra git root. Keep `apps/intell` archived/renamed later. | M0 |
| A11 | Indigenous knowledge in content guidelines vs preferences “no engagement workstream” | PRODUCT §8 vs preferences | **No engagement workstream / no product gating.** If a seed or story touches Indigenous knowledge, treat as `sensitive_culture` editorial flag requiring documented permission **before publish** — process, not a build milestone. | Editorial |
| A12 | What to do with PR #1 | Build posture | **Leave open / label as spike**; do not merge as product foundation. M0 from `master`. | Process |
| A13 | EAS / real devices for M0 accept | BUILD_PLAN M0 | Cloud agents may lack iOS/Android hardware. **Accept M0 when:** admin runs, Expo web or Expo start boots, CI green; note “native EAS smoke” as follow-up on a physical device when available. | M0 accept criteria honesty |

---

## 5. Spec conflict order (applied)

| Topic | Winner | Loser / note |
| --- | --- | --- |
| Listener discovery chrome | PRODUCT (map-home) | Old preferences region browse; v0 demo; product-description Nearby/Search/Browse |
| Schema names | DATA_MODEL | Informal “Place/Route/Stop” language |
| Mix / Hush / wildlife | AUDIO_SPEC | Any “silence segment as story clip” metaphor from v0 (Hush is a *mix* behavior; silence leaves still exist as content gaps via unlock, not as the Hush system) |
| Implementation stack | TECH_SPEC | Ad-hoc Expo app without shared/admin |
| Indigenous engagement as workstream | Preferences (locked) | Softened reading of PRODUCT §8 community permission — kept as editorial rights, not a program track |

---

## 6. Recommended next milestone

### Start **M0 — Scaffold** immediately after JoJo skims this pair of docs.

**Why M0, not more demo polish:** every later milestone assumes pnpm/Turborepo, `apps/mobile` + `apps/admin`, `packages/shared`, Supabase init, and CI. Extending PR #1 deepens the wrong IA.

**M0 scope (BUILD_PLAN):**
- pnpm workspaces + Turborepo  
- Expo app (Router, TS strict, EAS profiles stub)  
- Next.js admin (Tailwind, shadcn/ui)  
- `packages/shared`: zod `L10n` + events schema stub  
- `supabase init`  
- `tools/landcover/` stub  
- CI; `.env.example`; README; `docs/adr/`  
- Copy the eight specs into repo `docs/` (BUILD_PLAN prompts assume `docs/PRODUCT_SPEC.md` etc.)

**M0 acceptance (pragmatic in this environment):**
- `pnpm lint && pnpm typecheck && pnpm test` green (or equivalent stubs)  
- Admin `next dev` boots  
- Mobile Expo boots (web and/or `expo start`)  
- Specs present under `docs/`  
- Native dual-platform EAS install noted as **deferred hardware check**, not a silent claim  

**Do not** start M1–M12 in the same turn as a shallow rush; M1 needs real devices for the 60-minute spike.

---

## 7. Suggested JoJo actions

1. **Read** [`intell-v2-architecture.md`](./intell-v2-architecture.md) (20–30 min).  
2. **Confirm or override** defaults A1–A13 above (especially A2 tiles before M5, A7 accessible play, A10 repo layout, A12 PR #1).  
3. **Approve M0** on a new branch from `master` (docs + scaffold).  
4. Plan **M1 audio spike** on physical iPhone + Android as the next real risk burn-down.  
5. Keep PR #1 as reference spike; do not treat its list UI as product.

---

## 8. Document control

| Field | Value |
| --- | --- |
| Path | `docs/intell-v2-gap-and-decisions.md` |
| Revision | 2026-11-19 |
