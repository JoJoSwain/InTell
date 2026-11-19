# AGENTS.md — InTell (Replaceplace)

Instructions for every coding agent working in this repo: Cursor, Claude Code, cloud agents. Read this file fully at the start of every task.

## 1. What we're building

**InTell** is Replaceplace's native, map-first audio app for the InDigeny story pathway. Three audio layers play together on the phone:

1. **Story:** narrated Root → Branch → Leaf fragments anchored to GPS points inside Grove polygons, played by proximity
2. **Surroundings:** randomly arranged sound effects and beds that match the setting
3. **Soundtrack:** music tied to geofenced zones and story state

Listeners grow the story through Seeds, Crossroads and Rings. **People write and record everything that plays.** The interface is deliberately minimal so people pay attention to the place, not the screen.

## 2. Source of truth

The specs live in `docs/` (one copy only; don't create duplicates):

| Doc | Wins on |
|---|---|
| `docs/PRODUCT_SPEC.md` (start here) | behavior and scope |
| `docs/DATA_MODEL.md` | schema, packs, storage, RLS |
| `docs/AUDIO_SPEC.md` | sound layers, engine, mixing, Hush |
| `docs/TECH_SPEC.md` | implementation and stack |
| `docs/JOURNAL_SPEC.md`, `docs/PARTICIPATION_SPEC.md`, `docs/DESIGN.md` | their areas |
| `docs/BUILD_PLAN.md` | milestone order and acceptance criteria |
| `docs/adr/*` | decisions that amend the specs (an *Accepted* ADR beats the spec it names) |
| `docs/briefs/*` | the task brief for the current milestone |

**Spec changes flow one way:** the product owner and architect decide → docs are updated → then code changes. If the code needs to differ from the spec, stop and say so. Don't silently diverge.

## 3. How to work

1. **One milestone (or brief) at a time**, on its own branch: `m<N>-<slug>` (e.g. `m2-database`). Don't mix milestones in one branch.
2. **Plan first.** For anything beyond a one-file change, produce a plan and wait for approval. In the plan, list every spec ambiguity you found. Never invent product behavior.
3. **Check `git status` before you start**, and don't overwrite uncommitted work you didn't create.
4. **Only one agent at a time edits `supabase/migrations/`.**
5. Keep `pnpm lint && pnpm typecheck && pnpm test` green.
6. **Ask before adding a dependency** that isn't in TECH_SPEC §1. Mobile packages are installed with `pnpm exec expo install <pkg>` (from `apps/mobile`) so versions match the Expo SDK.
7. **Finish with a short report:** what changed, the commands you ran and their results, what you didn't do, and any open questions.

## 4. Repo layout
```
apps/mobile      Expo Router app. Routes live in apps/mobile/app/ (NOT src/app/); non-route code in apps/mobile/src/
apps/admin       Next.js App Router staff tools (src/app/)
packages/shared  zod schemas + ALL pure decision logic (unlock, trigger, ambience, music, hush,
                 tree layout, storybook, eligibility, geo), unit-tested with Vitest
supabase/        migrations, edge functions, seed.sql
tools/landcover  NLCD → H3 grid builder (staff tool)
docs/            specs, ADRs, briefs
_ Archive/       legacy prototypes and old notes; read-only history; never import from it
```

## 5. Hard constraints (never violate)

- **Minimal UI.** Home is the map, plus three sub-screens (Journal, Grow, Settings) opened from the bottom bar. No extra tabs, feeds, search, lists of nearby content, percentages, streaks, badges, leaderboards or push notifications. Sound and music zones are never drawn on the map.
- **No AI generation** of text, narration, music or sound anywhere: not in the app, the admin or the publish pipeline.
- **On site only.** New fragments play only by proximity, QR or accessible play. Crossroads votes need the anchor fragment heard, presence within the vote radius, and device attestation. The Journal replays only revisions the device has heard; off site it plays narration only (Echo).
- **Never reveal unrevealed content.** No transcript, title or location of an unrevealed fragment. Never expose protected-fragment coordinates or marker codes anywhere (packs, logs, Sentry, client). Match QR codes by sha256 hash.
- **Location never leaves the device.** Request "While Using" permission only, never "Always" or Android `ACCESS_BACKGROUND_LOCATION`. Background location only during an exploring session. Seeds and votes send anchor ids, never coordinates.
- **Rights gate playback.** Play only assets and revisions present in the currently installed pack manifests. Sync must delete every local asset whose sha isn't in a current manifest.
- **Wildlife safety.** Layers flagged `wildlife_call` never play through the phone speaker and are muted in nesting months.
- **Anonymous clients** may call only `get_pack_index`, public storage and the edge functions. Never ship the Supabase service role key or any secret to mobile or browser code. `device_id` is a bearer secret: never display or fully log it, and endpoints return only that device's data.
- **Participation safety.** Enforce the age gate (no seeds under 13; no published voice under 18). Strip PII server-side. Seed text and voice are never shown to other users. Credit names appear publicly only after moderation.
- **Accessibility and i18n.** Every narration version has a transcript. Every control and map marker has an accessibility label. All user-facing strings go through i18n. Respect reduced motion.
- **No outcome claims** in copy (no "reduce screen time" or "improve wellbeing").
- **Secrets.** `.env` files are gitignored; never commit keys. Add new variables to the matching `.env.example` with an empty value.

## 6. Conventions

- TypeScript strict with `noUncheckedIndexedAccess`. No `any` without a comment explaining why.
- zod schemas in `packages/shared/src/schemas`, reused by mobile, admin and edge functions.
- **Mobile:**
  - Expo Router; Zustand for the session and mixer; TanStack Query for network data; SQLite as the offline source of truth
  - Audio only through the `AudioEngine` interface; UI code never calls the audio library directly
  - Map markers as style-driven layers, not one React component per marker (see ADR 0002 for the map provider)
- **Admin:** Next.js App Router, server actions, shadcn/ui, Leaflet + Geoman, and a Web Audio `AudioEngine` for the Listening Simulator. RLS enforces roles; hiding UI is not security.
- Database changes only through `supabase/migrations/*.sql`; regenerate types after each one.
- Design tokens only (`apps/mobile/src/ui/tokens.ts`, mirrored in admin Tailwind); no raw hex values in components.
- Telemetry never includes coordinates, free text, credit names or audio.

## 7. Open decisions (don't build past them)

- **ADR 0002 (map provider) is Proposed.** Until it's Accepted, don't add new map features, marker systems or offline tile work. Bug fixes to the existing demo are fine.
- **ADR 0001 (audio engine)** is produced by Milestone 1. No audio-layer code beyond the M1 spike until it's Accepted.
- Product open questions: PRODUCT_SPEC §9 and `docs/intell-v2-gap-and-decisions.md` §4.

## 8. Commands
```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test     # must be green before declaring done
pnpm dev:admin                                # http://localhost:3000
pnpm dev:mobile                               # Expo dev server (dev client build required for native modules)
pnpm --filter @intell/shared test
```
**Windows notes** (the main dev machine is Windows):
- Native Android builds can fail on long paths (seen under `react-native-reanimated` CMake). Enable Windows long paths, or build from a short drive: `subst R: C:\Users\jorda\source\Replaceplace`.
- In PowerShell, `>` redirection corrupts binary output. Capture screenshots with `adb exec-out screencap -p > shot.png` from **cmd.exe**, or use `adb shell screencap /sdcard/s.png` + `adb pull`.

## 9. Expo guidance (applies to apps/mobile)

The Expo SDK changes every release; don't trust remembered APIs. Before using an Expo, EAS or React Native API:
1. Check the `expo` major version in `apps/mobile/package.json`.
2. Read the matching versioned docs at `https://docs.expo.dev/versions/v<major>.0.0/`. The index at https://docs.expo.dev/llms.txt lists corrections to common mistakes.

More rules for the mobile app are in `apps/mobile/AGENTS.md`.

## 10. Definition of done (every PR)

- Strict types; decision logic lives in `packages/shared` with tests
- No location, free text or audio in telemetry; no new data-collecting SDKs
- Strings in i18n; accessibility labels; reduced motion respected
- Docs or ADRs updated if behavior or stack changed
- A report covering changes, commands run and results, and open questions
