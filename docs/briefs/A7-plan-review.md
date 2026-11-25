# A7 plan review (Claude)

**Verdict:**
- **Part 1** (`c81cff6`) is accepted.
- **The M11 plan** is accepted, with the decisions and changes below.
- **Before M11**, do one small separate PR, **A7b**, because Lane B's M6 depends on it.

## Part 1
Accepted.
- The director now reads `ONESHOT_LOOKAHEAD_SEC` / `ONESHOT_MAX_PENDING`.
- `index.ts` uses named exports, so there's no duplicate-export risk.
- The extra re-export in `director.ts` is harmless; keep it or drop it.

## Root lint and typecheck: this isn't a failure on master
B·S3 added `audio-session` as a `file:` dependency of `apps/mobile`. This lane's `node_modules` was installed before B·S3 merged, so the link doesn't exist here. CI was green on master.
- Run `pnpm install --frozen-lockfile` in this lane, then run root `pnpm lint` and `pnpm typecheck` again.
- If anything still fails, report the exact error.
- Correct plan §7 step 10.

## A7b (do this first): deep device pack parsers, as a separate small PR
**The problem.** I missed this in my A5 review.
- `GrovePackDevice = GrovePack.strip()` strips unknown keys **only at the top level**.
- Every nested object in `packs.ts` is `.strict()`.
- So a new key inside a fragment, revision, cue or grove still fails to parse on an older phone, and the device parsers exist to prevent exactly that.
- The A5 test only covers a top-level key.

**Fix:**
- Build the strict and device variants from **one factory**: an object helper that's `.strict()` in strict mode and `.strip()` in device mode, used at every level. Refinements then survive. Don't write a runtime walker that rebuilds schemas.
- Keep the names `GrovePack` / `RegionPack` (strict) and `GrovePackDevice` / `RegionPackDevice` (device).
- Add **`PreviewManifestDevice`**, whose groves use `GrovePackDevice`.

**Tests:**
- An unknown key at **every nesting level** parses with the device parsers (and the key is removed), and fails with the strict parsers.
- The existing pack tests stay unchanged and green.

**Branch:** `a/a7b-device-parsers`, from `origin/master`. Open a PR titled "A7b: deep device pack parsers", and stop for review. Leave `a/a7-analytics` as it is meanwhile.

## Decisions on gaps G1–G20

**G1: versioning**
- Envelope field `v: 1` (a literal), and export `EVENT_SCHEMA_VERSION = 1`.
- New column `events.schema_version smallint not null default 1`.
- Ingest drops unknown versions.
- Adding an optional prop or a new enum value doesn't bump the version. Renaming or removing something does.

**G2: `fragment_completed`**
- Props are `{ time_window: "day" | "night", change_kind: "contingency" | "correction" | null }`. `null` means the revision has no change kind, matching the `change_kind` enum.
- Reuse the shared enums; don't redefine them.

**G3: ids**
- Grove, fragment, revision and session ids go **only** in the envelope columns, never in props.
- Change A4's `analytics` effect to `{ name, props, refs }`, where `refs` is `{ groveId?, fragmentId?, revisionId?, sessionId? }`.
- Fill `revisionId` when the world has it; otherwise leave it out.
- Update A4's tests. Lane B treats analytics as a no-op in M6, so this doesn't collide with M6.

**G4: who emits each event**
- **The session machine** emits:
  - `session_started` and `session_ended`
  - `grove_entered`
  - `fragment_triggered`, on every `play`, with `trigger` taken from `via`
  - `fragment_completed`
  - `fragment_unlocked`, one per fragment unlocked
- **The phone emits everything else**, through a typed shared builder, `makeEvent(name, props, refs)`:
  - `app_opened`, `pack_downloaded`, `route_changed`, and `teaser_opened` (whenever the teaser sheet opens, from a scan or from the map): M6/M7
  - `hush_*` and `mixer_changed`: M7
  - Chronicle events: M8
  - Journal events, check-ins and `growth_moment_played`: M9

**G5: unknown device**
- Return `404 { error: "device_not_registered" }`. The phone registers again and retries.
- Ingest never registers a device itself.

**G6: the response**
- `200 { accepted, duplicates, dropped: [{ clientEventId, reason }] }`.
- Reasons: `unknown_name | invalid_props | bad_version | future_dated`.
- The phone removes all three groups from its queue.
- A whole-batch `400` only for a bad envelope: a bad `deviceId`, events not an array, or more than 200 events.
- Drop events dated more than 24 h in the future. Keep old events, because phones queue offline.

**G7: who counts as a contributor**
- A contributor is a cohort device that submitted ≥ 1 Journal entry, of any kind or status, **within 14 days of its first session**. Every other device in the cohort is a non-contributor.
- The fixed early window stops people from counting as contributors just because they came back more often.
- Caption the comparison "Counts devices, not people. Not causal."

**G8: who can see the dashboard**
- Every §9 view is for `viewer+`.
- Pages and CSVs show aggregates only, never device-level rows.

**G9: what deletion removes**
- `delete-device-data` removes the device's `events`, its `journal_entries` (and `entry_links`, by cascade) with their voice files, its `checkins`, its `device_rate_limits` rows, **and the `devices` row itself**.
- It returns the counts.
- Rate limit: 5 per day.
- No `audit_log` row that holds the `device_id`.
- After a successful delete, the phone creates a new device ID (Lane B, later). Events that arrive afterwards for the deleted ID get a 404.

**G10: `export-archive`, version 1**
- **Scope:** the whole story, or one region if `regionId` is given.
- **Contents:**
  - every revision, with its status
  - transcripts, as Markdown, one per revision
  - Story Notes: threads, character notes and Indigeny notes
  - metadata, as JSON: regions, groves, fragments, characters and releases
  - a `manifest.json` listing every audio and image asset by sha, kind and storage path
- **No audio bytes in version 1.** Edge-function memory and time limits make a full audio zip risky. A `tools/` script to download the audio is a follow-up; I'll add it to the roadmap.
- `editor+` only.
- Write an `audit_log` row with the actor and the scope.
- Return the zip directly.

**G11:** confirmed. Listeners can only delete their data; there's no listener export.

**G12: queue cap**
- 5,000 events. When the queue is full, drop the oldest.

**G13: sending and retrying**
- **When to send:** when the app comes to the foreground, every 5 min while it's in the foreground, and when a session ends. At most 200 events per batch.
- **Retry** on a network error, 429 or 5xx:
  - start at 30 s and double each time, up to 30 min
  - add ±20% jitter
  - honour `Retry-After`
- **On 404:** register again, then retry.
- **On 401 or 403:** stop until the next app start.
- Keep it pure (inputs: now, last response) so it's testable.

**G14: `character_opened`**
- Props are `{ character_id }`, a uuid. It's a content id, not a personal one.
- This is the one exception to G3, because `events` has no character column.

**G15:** `pack_downloaded.scope` is `"grove" | "region"`.

**G16:**
- `mixer_changed.bus` is `"story" | "music" | "surroundings"`.
- `route_changed.route` reuses the director's `AudioRoute` enum: `headphones | bluetooth | speaker | unknown`.

**G17:** `replay_played.scope` is `"fragment"` only for now. M8 may add values (a new value doesn't bump the version).

**G18: tier for completed fragments**
- Left-join `fragments` to get the tier; a missing tier shows as `"unknown"`.
- Don't filter by publish status; history counts.

**G19: two Journal measures wait for M9**
- "% read within 14 days" and "median days to grown" need status history, which doesn't exist yet, and the Journal is finalized in M9.
- Leave those two out of M11 and say so in the report. M9 adds the timestamps and the two measures.

**G20: check-in response rate**
- Response rate = `checkin_submitted / (checkin_submitted + checkin_skipped)`, per month.

## Other required changes
1. **The views must respect RLS.**
   - Create every view `with (security_invoker = true)`. Without it, a view runs with its owner's rights and bypasses RLS.
   - Grant `select` to `authenticated` only, and revoke it from `anon` and `public`.
   - pgTAP:
     - `anon` can't select
     - a signed-in non-staff user gets zero rows
     - staff see the numbers
2. **Charts:** tables plus simple bars built from the existing UI. Ask before adding a chart library.
3. **The fixture:**
   - Load it inside the test transaction (no reset).
   - Write the expected numbers out by hand in a comment beside the data, so the test isn't circular.
4. **Order:**
   - A7b first, as its own PR.
   - Then plan §7, with the A4 analytics change (G3/G4) inside step 1.

## VoiceLedger
Accepted. Keep it out of `directorStep`; each engine host owns its own instance.

## Checkpoints
- **Stop after plan §7 step 4** (schemas, ingest, pgTAP and the queue), because that's the contract with the phone. Report briefly, and wait for my check.
- **Then finish steps 5–10, and stop for review.**
- `pnpm lint`, `typecheck` and `test` must pass, and both CI jobs must be green at each stop.
- No database reset without asking Jordan. Nothing aimed at staging.
