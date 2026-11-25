# A7 plan — M11 analytics (Lane A)

**Branch:** `a/a7-analytics` · **Sources:** BUILD_PLAN M11, TECH_SPEC §5/§8/§9, DATA_MODEL (devices / events / journal / checkins / deletion), PRODUCT_SPEC FR-15 / privacy, A4 `session` analytics effects, existing `events` table + RLS.

**Part 1 (done):** `ONESHOT_LOOKAHEAD_SEC` / `ONESHOT_MAX_PENDING` are the single source; AudioDirector imports them; `DIRECTOR_ACCENT_*` removed (nothing outside `packages/shared` imported them). No behaviour change.

**This document is plan only.** No M11 implementation until Claude reviews.

---

## 0. VoiceLedger vs AudioDirector (propose only)

**Recommendation: do not put `VoiceLedger` inside `directorStep`.**

| Concern | Owner today | Role |
|---|---|---|
| 12-slot budget / shed | `allocateVoices` in `directorStep` | Pure: which ids get a slot this tick |
| Live create / start / release / sweep | B·S2 `VoiceLedger` | Impure bookkeeping for real engine voices |

`directorStep` must stay a pure reducer (deterministic, no side effects). `VoiceLedger` tracks lifecycle of voices the **engine host** actually creates. Wiring it into the director would either break purity or duplicate the host's truth.

**Propose (later audio milestone, not M11):**
1. Keep `allocateVoices` as the director's only voice-budget tool.
2. Admin WebAudio engine and Lane B's mobile engine each own a `VoiceLedger` instance; mark create/start/release on engine commands; sweep past-end voices with the existing grace.
3. Optional: surface `VoiceLedgerStats` to a staff-only debug / Listening Simulator panel — not to telemetry (`mixer_changed` stays `{bus}` with no values per TECH_SPEC §8).

No mobile import of `DIRECTOR_ACCENT_*` was found; Part 1 needed no Lane B flag.

---

## 1. Event list ↔ zod schemas

### 1.1 TECH_SPEC §8 (source of truth for M11)

| Area | Name | Props (spec) | Top-level columns (DATA_MODEL `events`) |
|---|---|---|---|
| App | `app_opened` | (none) | — |
| App | `pack_downloaded` | `{scope, bytes}` | — |
| Session | `grove_entered` | (none listed) | `grove_id` |
| Session | `session_started` | (none) | `session_id` |
| Session | `session_ended` | `{fragments_completed, minutes}` | `session_id` |
| Story | `fragment_triggered` | `{trigger: proximity\|scan\|accessible, time_window}` | `fragment_id`, `revision_id?`, `grove_id?`, `session_id` |
| Story | `fragment_completed` | `{time_window, change_kind}` | `fragment_id`, `revision_id?`, `session_id` |
| Story | `fragment_unlocked` | (none) | `fragment_id?` |
| Story | `teaser_opened` | (none) | `fragment_id?` |
| Story | `growth_moment_played` | (none) | `fragment_id?` |
| Audio | `hush_started` | (none) | `session_id?` |
| Audio | `hush_skipped` | (none) | `session_id?` |
| Audio | `mixer_changed` | `{bus}` (no values) | — |
| Audio | `route_changed` | `{route}` | — |
| Chronicle | `chronicle_opened` | (none) | — |
| Chronicle | `character_opened` | (none) | `—` (character id **not** a column; see gaps) |
| Chronicle | `replay_played` | `{scope, time_window}` | `fragment_id?` |
| Chronicle | `show_on_map_tapped` | (none) | `fragment_id?` |
| Journal | `journal_opened` | (none) | — |
| Journal | `entry_submitted` | `{kind, on_site, voice}` | — |
| Journal | `question_viewed` | (none) | — |
| Journal | `checkin_submitted` | (none) | `grove_id?`, `session_id?` |
| Journal | `checkin_skipped` | (none) | — |

Envelope (DATA_MODEL + existing stub): `client_event_id`, `name`, `occurred_at`, optional `grove_id` / `fragment_id` / `revision_id` / `session_id`, `props` jsonb. Privacy: never coordinates, marker codes, free text, credit names, or audio. `device_id` is the only listener identifier (bearer secret; log ≤ 8 chars).

### 1.2 Proposed shared schema shape

Replace the stale stub in `packages/shared/src/schemas/events.ts`:

1. Keep a strict **envelope** schema (`TelemetryEvent`) matching the ingest body item (camelCase at the wire, snake in Postgres — same pattern as `RegisterDeviceRequest`).
2. `EVENT_NAMES` = exactly the §8 set above (drop pre-ADR-0004 leftovers).
3. Per-name **props** schemas as a discriminated map / `z.discriminatedUnion` on `name`, versioned (see gap G1).
4. Unknown `name` or props that fail zod → **dropped** at ingest (brief), not 400 for the whole batch (see ingest design).
5. Unit tests: every §8 name parses; forbidden keys rejected; A4 effect props checked against the map.

### 1.3 A4 session analytics — mismatches (flag, don't invent)

A4 emits only four names via `SessionEffect` `analytics`:

| A4 name | A4 props today | §8 expectation | Status |
|---|---|---|---|
| `grove_entered` | `{grove_id}` | no props listed; `grove_id` is a column | **Mismatch:** id in props vs column-only |
| `session_started` | `{}` | none | OK |
| `session_ended` | `{fragments_completed, minutes}` | same | OK (minutes = wall `(endedAt−startedAt)/60_000`, not `computedPlayedMs` — confirm intentional) |
| `fragment_completed` | `{fragment_id}` | `{time_window, change_kind}` | **Mismatch:** missing `time_window` / `change_kind`; `fragment_id` belongs on the column |

A4 does **not** emit: `fragment_triggered`, `fragment_unlocked`, `teaser_opened`, `growth_moment_played`, hush / mixer / route, Chronicle, Journal, `app_opened`, `pack_downloaded`. Session has a `growthMoment` **effect** (not analytics) and notes it is "M9 Journal hook; not emitted yet."

**Lane A for M11:** define schemas for the full §8 list. Aligning A4 emitters / Lane B wiring is a follow-up once Claude picks column-vs-props and the `fragment_completed` shape (gaps G2–G4).

### 1.4 Existing stub drift

`EVENT_NAMES` currently still lists ADR-0004-removed / renamed items (`fragment_heard`, `fragment_revealed`, `moment_opened`, `echo_played`, `field_note_*`, `grow_opened`, `seed_planted`, `vote_cast`, `ledger_opened`, …) and omits §8 names (`fragment_completed`, `fragment_unlocked`, `teaser_opened`, `chronicle_opened`, `character_opened`, `replay_played`, `entry_submitted`, …). **Replace wholesale** with §8.

---

## 2. Ingest design (`ingest-events`)

Mirror `register-device` (TECH_SPEC §5–§6):

| Item | Proposal |
|---|---|
| Auth | `verify_jwt = false`; `requirePublishableCaller`; refuse missing key (401), secret key / lone staff JWT (403) |
| Body | `{ deviceId, events: TelemetryEvent[] }` with `events.length` in `1…200` |
| Rate limit | `fn_device_rate_allow(device_id, 'ingest-events', 600, 3600)` → 429 |
| Device | Must already exist in `devices` (register-device first); unknown device → 404 or 400 (**gap G5**) |
| Validate | Per-event zod; **drop** unknown names / bad props; accept valid subset |
| Idempotency | `unique (device_id, client_event_id)`; insert with `ON CONFLICT DO NOTHING` (or equivalent); count inserted vs skipped |
| Storage | Existing `public.events` (M2 ops migration); service role client (bypasses RLS) |
| Response | `{ ok: true, accepted, dropped, duplicate }` (exact shape TBD — gap G6) |
| Logging | `device=` first 8 chars only; never props that could echo secrets |

**RLS / grants (already largely present):**
- RLS enabled on all public tables (M2a).
- `events_staff_select`: authenticated staff roles may `SELECT`.
- No INSERT/UPDATE/DELETE policies for `authenticated` on `events` → staff cannot write events via PostgREST; `anon` revoked.
- Ingest writes only through the edge function + service role.
- pgTAP: prove `anon` / non-staff JWT cannot read or write; staff can select; publishable-key path only via function tests.

**No new table** unless Claude wants a `schema_version` column (gap G1).

---

## 3. Views and dashboard pages

### 3.1 SQL views (TECH_SPEC §9, America/Denver months)

| View (proposed name) | Definition from §9 |
|---|---|
| `v_dash_visits` | `session_started` counts per grove (and overall) |
| `v_dash_fragments_completed` | `fragment_completed` per grove, tier, time window — **needs join to `fragments.tier`**; props must carry `time_window` (G2) |
| `v_dash_depth` | Share of sessions with ≥1 branch completed and ≥1 leaf completed (show n) |
| `v_dash_return_6mo` | Cohort = devices whose first `session_started` falls in month M with M+6 ≤ today (Denver); returned = another session 1–183 days later; show `returned/cohort`; caption *"Counts devices, not people."* |
| `v_dash_participation` | Journal: by `entry_kind`; unique contributors (`device_id`); % on site; % read within 14 days; % grown; median days to grown |
| `v_dash_contribution_return` | Same cohort as return: return rate for Journal contributors vs non-contributors (n each) — **contributor definition gap G7** |
| `v_dash_checkins` | n, response rate, mean before→now change (n); caption *"Self-reported, optional, not causal."* |

Months: `timezone('America/Denver', occurred_at)` (or `submitted_at` for journal).

### 3.2 Admin pages

TECH_SPEC §1 route tree already has `(dash)/dashboard` (not a separate `/analytics`). Plan:

| Surface | Content | Role |
|---|---|---|
| `/dashboard` | Charts + tables for all §9 views; CSV download per view | Staff who can `SELECT` events / journal / checkins (viewer+) — **§9 does not say admin-only** |
| CSV | One export action per view; no coordinates / free text columns | Same |

**Gap G8:** brief says "admin-only pages where TECH_SPEC says so." §9 does not mark any dashboard view admin-only. `invite-staff` / audit export patterns are the only admin-only ops nearby. Propose: all §9 views for `viewer+` unless Claude restricts contribution-return or check-ins further.

No new `(dash)` segment unless Claude wants `/dashboard/analytics` nested — not in the §1 tree today.

Charts: reuse existing admin UI patterns (shadcn); no new chart dependency without asking.

---

## 4. Deletion and export

### 4.1 `delete-device-data` (mobile device endpoint)

TECH_SPEC §5: cascades the device's **events**, **Journal entries (and voice files)** and **check-ins**; returns counts.

| Step | Detail |
|---|---|
| Auth | Same publishable-key + rate-limit pattern as register-device |
| Body | `{ deviceId }` (uuid v4) |
| DB | Delete (or rely on `ON DELETE CASCADE` from `devices`) rows in `events`, `journal_entries` (+ `entry_links`), `checkins`. **Gap G9:** does the function also delete the `devices` row itself and `device_rate_limits`? Spec lists cascades of child data, not "unregister." |
| Storage | Remove `journal-voice/{id}.m4a` for that device's entries (private bucket). Retention cron (DATA_MODEL §9 ops) is separate. |
| Response | Counts: `{ events, journal_entries, checkins, voice_files }` (exact keys TBD) |
| Tests | Fixture device with rows + a voice object → after delete, zero rows and object gone; other devices untouched |

PRODUCT_SPEC Settings "Delete my data" is the client affordance; Lane B wires the call (Lane A does not edit `apps/mobile`).

### 4.2 `export-archive` (admin editor+)

TECH_SPEC §5: **staff** zip of revisions, transcripts, Story Notes and metadata for preservation **outside InTell** — content archive, **not** a listener data export.

| Item | Proposal |
|---|---|
| Auth | Staff JWT; `editor` / `admin` (match publish/unpublish) |
| Input | Gap G10: scope unspecified (whole story? one grove? one release?) |
| Contents | Revisions + transcripts + Story Notes + metadata; **no** journal bodies, no events, no coordinates beyond what's already in published content points if included — confirm |
| Delivery | Zip download or signed Storage URL |

**Gap G11:** PRODUCT_SPEC has no "export my data" for listeners. Only delete. Do not invent a listener export.

---

## 5. Shared event queue (Lane A: logic only)

Pure module in `packages/shared` (e.g. `packages/shared/src/analytics/eventQueue.ts`), unit-tested. Lane B wires persistence + `fetch` in M6/M7. **Lane A never edits `apps/mobile`.**

| Responsibility | Proposal | Spec status |
|---|---|---|
| Enqueue | Append validated envelope + generate `clientEventId` if missing | — |
| Cap | Drop oldest or refuse when over cap | **Gap G12:** cap size not in TECH_SPEC |
| Batch | Take ≤ 200 for one POST | Spec: ≤ 200 |
| Retry / backoff | On 429 / 5xx; stop on 401/403 | **Gap G13:** intervals / max attempts unspecified |
| Ack | Remove accepted + duplicates; keep dropped? (dropped are invalid — discard) | — |
| Privacy | Queue stores only schema-legal fields; no coords / free text | Hard constraint |

Export types + pure functions only; no I/O.

---

## 6. Fixture dataset

BUILD_PLAN M11: dashboard numbers match a fixture, including contribution-return.

| Piece | Proposal |
|---|---|
| Location | `supabase/tests/fixtures/m11_analytics.sql` (or `tools/` seed) loaded in pgTAP / dashboard tests — **path not mandated by spec** |
| Contents | Fixed `devices`, `events` (`session_started` / `session_ended` / `fragment_completed` with known props), `journal_entries` (+ statuses for read/grown timing), `checkins`; Denver-stable timestamps |
| Assertions | Expected `returned/cohort`, contributor vs non-contributor rates, depth shares, CSV column totals |
| Isolation | No production/staging aim; local + CI only. **Ask Jordan before any local `db reset`.** |

---

## 7. Order of work (after plan approval)

1. **Schemas** — rewrite `events.ts` + tests; document A4 mismatches; do not silently change A4 emitters without Claude's call on G2–G4.
2. **Ingest** — `supabase/functions/ingest-events` + Deno tests (zod drop, 600/h, idempotency, publishable auth, device_id log ≤ 8).
3. **pgTAP** — RLS/grants on `events`; anon denied.
4. **Shared queue** — pure batch/retry/cap module + Vitest.
5. **SQL views** — migration for §9 views (Denver months); grants to `authenticated` as needed for staff SELECT.
6. **Fixture + view tests** — contribution-return included.
7. **Admin dashboard** — wire `/dashboard` to views; CSV per view; captions from §9.
8. **`delete-device-data`** — function + cascade/voice tests.
9. **`export-archive`** — after G10 scope answer; editor+ only.
10. **Green** — `pnpm lint && pnpm typecheck && pnpm test` (Lane A packages); both CI jobs. Note: as of this plan, root `pnpm lint` / `typecheck` fail on **pre-existing** `@intell/mobile` `audio-session` resolution from B·S3 on `master` — Lane B owns that; A7 must not edit `apps/mobile`.

No staging deploys. No db reset without Jordan.

---

## 8. Spec gaps (do not guess)

| ID | Gap | Why it blocks or biases implementation |
|---|---|---|
| G1 | "Versioned" event schemas — wire format? column? package export only? | Affects migrations and ingest |
| G2 | `fragment_completed` props: A4 sends `{fragment_id}`; §8 wants `{time_window, change_kind}` | Views need `time_window`; `change_kind` enum is `contingency`\|`correction` |
| G3 | `grove_entered`: props `{grove_id}` vs column `grove_id` | Duplication / privacy consistency |
| G4 | Who emits the rest of §8 (session vs director vs Lane B UI)? | Shared can only schema; emitters span lanes/milestones |
| G5 | Ingest when `device_id` is not registered | 404 vs auto-register vs drop |
| G6 | Ingest response shape for partial accept | Client queue ack semantics |
| G7 | "Journal contributor" for contribution-return: any entry ever? in cohort window? any status? | View definition |
| G8 | Dashboard role: all staff vs admin-only for some tiles | Brief vs §9 silence |
| G9 | `delete-device-data`: delete `devices` row / rate-limit rows? | Product "Delete my data" / "Reset device ID" are separate in Settings |
| G10 | `export-archive` scope and file layout | Cannot build zip without it |
| G11 | No listener-side data export in specs | Confirm delete-only |
| G12 | Event queue max size | Shared cap constant |
| G13 | Retry/backoff policy | Shared queue behaviour |
| G14 | `character_opened` — where is `character_id` stored? (no column on `events`) | props-only vs schema change |
| G15 | `pack_downloaded.scope` enum values (`grove`\|`region`?) | zod enum |
| G16 | `mixer_changed.bus` / `route_changed.route` allowed values | zod enums |
| G17 | `replay_played.scope` allowed values | zod enum |
| G18 | Depth / completed views: join `fragment_id` → `fragments.tier` when fragment may be unpublished/retired? | Historical accuracy |
| G19 | `% read within 14 days` clock: `submitted_at` → first transition to `read`? | Journal status audit not stored |
| G20 | Check-in "response rate" denominator (sessions? grove entries? prompts shown?) | Not in §9 |

---

## 9. Out of scope for A7 implementation (when approved)

- Any edit under `apps/mobile`
- Changing AudioDirector behaviour beyond Part 1 (already shipped)
- Wiring `VoiceLedger` into the director (proposal in §0 only)
- Staging / hosted deploy
- Local `db reset` without Jordan's OK
- Resolving mobile `audio-session` lint/typecheck (Lane B / B·S3)

---

## 10. Acceptance mapping

| BUILD_PLAN / brief | Plan coverage |
|---|---|
| Event queue + `ingest-events` | §2, §5 |
| Every TECH_SPEC §8 event (zod) | §1 |
| Dashboard views + pages + CSV | §3 |
| `delete-device-data` | §4.1 |
| `export-archive` | §4.2 |
| Fixture matches contribution-return | §6 |
| Delete removes every server row + voice file | §4.1 tests |
| No coords / listener text stored | §1, §2, §5 |
| device_id log ≤ 8 chars | §2 |
| Stop for plan review | This file; no M11 code yet |
