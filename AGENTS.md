# AGENTS.md — InTell (Replaceplace)

Instructions for every coding agent working in this repo: Cursor, Claude Code, cloud agents. Read this file fully at the start of every task.

## 1. What we're building

**InTell** is Replaceplace's native, map-first audio app and its **story pathway** (*Find your place in story*). It exists to bring forward **Indigeny**, the phenomenon all of Replaceplace's pathways explore: the embodied struggle between Earth (the physical environment) and World (cultural practice, history, social norms), so people explore themselves and their relationship with Place through stories met in real places (ADRs 0004 and 0005).

**The core experience** is being physically present in a real place. Three audio layers play together on the phone:

1. **Story:** narrated Root, Branch and Leaf fragments anchored to GPS points inside Grove polygons, played by proximity (or by scanning a physical marker), unlocked through a logic chain of prerequisites that can span groves
2. **Surroundings:** randomly arranged sound effects and beds, played by geofenced zones, Day or Night
3. **Soundtrack:** music tied to geofenced zones and story state, Day or Night

The **Chronicle** (look back at what you've encountered, navigated by character) and the **Journal** (share thoughts that Replaceplace's writers draw on) are supporting features. **Replaceplace staff write, record and compose everything that plays.** The interface is deliberately minimal so people pay attention to the place, not the screen.

## 2. Source of truth

The specs live in `docs/` (one copy only; don't create duplicates):

| Doc | Wins on |
|---|---|
| `docs/PRODUCT_SPEC.md` (start here) | behavior and scope |
| `docs/DATA_MODEL.md` | schema, packs, storage, RLS |
| `docs/AUDIO_SPEC.md` | sound layers, engine, mixing, Hush |
| `docs/TECH_SPEC.md` | implementation and stack |
| `docs/JOURNAL_SPEC.md`, `docs/PARTICIPATION_SPEC.md`, `docs/DESIGN.md` | their areas, **except where marked superseded by ADR 0004** |
| `docs/BUILD_PLAN.md` | milestone order and acceptance criteria |
| `docs/adr/*` | decisions that amend the specs (an *Accepted* ADR beats the spec it names). **ADR 0004 (product realignment) beats every older spec text it contradicts.** |
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
packages/shared  zod schemas + ALL pure decision logic (unlock, trigger, timeWindow, ambience, music, hush,
                 chronicle, eligibility, geo), unit-tested with Vitest
supabase/        migrations, edge functions, seed.sql
tools/landcover  NLCD → H3 grid builder (staff tool)
docs/            specs, ADRs, briefs
_ Archive/       legacy prototypes and old notes; read-only history; never import from it
```

## 5. Hard constraints (never violate)

- **The place comes first.** Every feature serves the on-site encounter. The Chronicle and the Journal support it and never substitute for it.
- **Minimal UI.** Home is the map with Chronicle (bottom left), **Embark** (center), Journal (bottom right) and Settings (top right). No extra tabs, feeds, search, lists of nearby content, percentages, streaks, badges, leaderboards or push notifications. Sound and music zones are never drawn on the map.
- **No AI generation** of text, narration, music or sound anywhere: not in the app, the admin or the publish pipeline. Journal-informed authoring is done by Replaceplace's human writers.
- **Replaceplace-only content.** Everything that plays is produced by Replaceplace staff. Nothing a listener submits is ever played, shown to other users or credited.
- **Hands-free, one story at a time.** Narration starts automatically on arrival; there is no Play button for a first listen. Only one story fragment ever plays at a time: a second trigger waits in a queue of one and never overlaps (surroundings and soundtrack play alongside narration as usual).
- **In situ first.** A fragment is first heard only on site: automatically by proximity (or by the accessible-play trigger within 35 ft of its point), or by scanning its physical marker. It becomes replayable in the Chronicle (anywhere, narration only off site) only after it has been **completed** on site, and only for the time version (Day or Night) that was completed.
- **Locked means teaser only.** Locked and out-of-window fragments appear on the map at 35% opacity. Tapping one shows only its authored teaser: never its title, transcript or audio. Marker codes never leave Postgres (packs carry only their sha256 hash) and are never logged.
- **Location never leaves the device, except an Embark route request.** Request "While Using" permission only, never "Always" or Android `ACCESS_BACKGROUND_LOCATION`. Background location only during an exploring session. The only coordinates that ever leave the phone are the origin of an Embark route the listener asks for: sent to the `embark` relay and Google, and **never stored, logged, put in telemetry or sent to Sentry** (ADR 0005). Journal entries send anchor ids, never coordinates.
- **No cars.** Embark offers walk, bike and transit only. Never add a driving mode, parking, or any car-related information or copy anywhere (ADR 0005 §6). The Routes API key lives only in edge-function secrets.
- **Progress stays on the phone** (no listener accounts or progress sync) and must live where the OS backup includes it (ADR 0005 §1).
- **Packs gate playback.** Play only assets and revisions present in the currently installed pack manifests. Sync must delete every local asset whose sha isn't in a current manifest. Only published releases reach phones; drafts reach only a signed-in staff device in preview mode.
- **Wildlife safety.** Layers flagged `wildlife_call` never play through the phone speaker and are muted in nesting months.
- **Anonymous clients** may call only `get_pack_index`, public storage and the device edge functions. Never ship the Supabase service role key, secret API key, or any secret to mobile or browser code. `device_id` is a bearer secret: never display or fully log it, and endpoints return only that device's data.
- **`verify_jwt = false` only for service-called edge functions** that validate a secret key in-function (`requireServiceCaller` / publish service path), with tests proving every other caller is refused. Staff-JWT-only functions keep platform JWT verification on.
- **Explicit API-role grants.** Supabase no longer auto-grants new `public` objects to API roles. Every migration grants what each role needs explicitly. `service_role` is covered by the default privileges from M3g. Local config sets `auto_expose_new_tables = false` to match hosted.
- **Journal safety.** Enforce the age gate (no Journal entries under 13). Strip PII server-side. Entries are private to Replaceplace staff.
- **Accessibility and i18n.** Every narration version has a transcript. Every control and map marker has an accessibility label. Every image has alt text. All user-facing strings go through i18n. Respect reduced motion. Distances are shown in feet and miles.
- **No outcome claims** in copy (no "reduce screen time" or "improve wellbeing").
- **Secrets.** `.env` files are gitignored; never commit keys. Add new variables to the matching `.env.example` with an empty value.

## 6. Conventions

- TypeScript strict with `noUncheckedIndexedAccess`. No `any` without a comment explaining why.
- zod schemas in `packages/shared/src/schemas`, reused by mobile, admin and edge functions.
- **Mobile:**
  - Expo Router; Zustand for the session and mixer; TanStack Query for network data; SQLite as the on-device source of truth (installed packs, completions, Chronicle)
  - Audio only through the `AudioEngine` interface; UI code never calls the audio library directly
  - Google Maps through `react-native-maps` (ADR 0002). Keep markers cheap: memoized marker views with `tracksViewChanges` off once rendered, clustering only if 300 markers don't pan smoothly
- **Admin:** Next.js App Router, server actions, shadcn/ui, the Google Maps JavaScript API with Terra Draw for drawing polygons (Google's own drawing library is discontinued), and a Web Audio `AudioEngine` for the Listening Simulator. RLS enforces roles; hiding UI is not security.
- Database changes only through `supabase/migrations/*.sql`; regenerate types after each one.
- Design tokens only (`apps/mobile/src/ui/tokens.ts`, mirrored in admin Tailwind); no raw hex values in components.
- Telemetry never includes coordinates, free text, credit names or audio.

## 7. Open decisions (don't build past them)

- **ADR 0002 (map provider) is Accepted: Google Maps, online.** Phones use `react-native-maps` with Google; the admin uses the Google Maps JavaScript API. No offline map tiles.
- **ADR 0001 (audio engine)** is produced by Milestone 1. No audio-layer code beyond the M1 spike until it's Accepted.
- **ADR 0004's open questions are resolved by ADR 0005** (Embark, the changed-fragment pulse and change teaser, character cards with one home grove, other-time hints, progress via OS backup, no printable guide), **except** children and the Journal, which needs counsel before M9. Don't decide that one in code; ask.
- Product open questions: PRODUCT_SPEC §9.

## 8. Commands
```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test     # must be green before declaring done
pnpm dev:admin                                # http://localhost:3000
pnpm dev:mobile                               # Expo dev server (dev client build required for native modules)
pnpm --filter @intell/shared test
```
**Windows setup** (the main dev machine is Windows):
- Keep the repo at a short path like `C:\dev\intell`. Do **not** use `subst` drives — they break the Android build with a CMake “different roots” codegen error.
- Enable Windows long paths (`LongPathsEnabled` = 1). See https://docs.expo.dev/troubleshooting/windows-long-paths/
- Install Android SDK CMake **3.31.6**, and set `android.cmakeVersion=3.31.6` in the user-level `%USERPROFILE%\.gradle\gradle.properties` (also in `apps/mobile/android/gradle.properties` if Expo still picks 3.22.1; re-add after `prebuild --clean`).
- Set `$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"` in the PowerShell session before `expo run:android`. Set `JAVA_HOME` to Android Studio’s JBR if needed.
- In PowerShell, `>` redirection corrupts binary output. Capture screenshots with `adb exec-out screencap -p > shot.png` from **cmd.exe**, or use `adb shell screencap /sdcard/s.png` + `adb pull`.

## 9. Expo guidance (applies to apps/mobile)

The Expo SDK changes every release; don't trust remembered APIs. Before using an Expo, EAS or React Native API:
1. Check the `expo` major version in `apps/mobile/package.json`.
2. Read the matching versioned docs at `https://docs.expo.dev/versions/v<major>.0.0/`. The index at https://docs.expo.dev/llms.txt lists corrections to common mistakes.

More rules for the mobile app are in `apps/mobile/AGENTS.md`.

## 10. Definition of done (every PR)

- Strict types; decision logic lives in `packages/shared` with tests
- No location, free text or audio in telemetry; no new data-collecting SDKs
- Strings in i18n; accessibility labels and image alt text; reduced motion respected; distances in feet and miles
- Docs or ADRs updated if behavior or stack changed
- A report covering changes, commands run and results, and open questions
