# InTell — Product Spec (v2)

> InTell is the native app for **InDigeny**, Replaceplace's story pathway: an in-place audio experience where narrated story fragments, a generative soundscape of the surroundings and an adaptive soundtrack play as you move through real places. The story grows over time from what listeners plant.

**Doc map** (read in this order):
| Doc | Covers |
|---|---|
| `PRODUCT_SPEC.md` (this file) | Concept, principles, scope, home map, flows, requirements |
| `AUDIO_SPEC.md` | The three audio layers, the engine, mixing, Hush moments |
| `JOURNAL_SPEC.md` | The Journal sub-screen (fragments you've heard) |
| `PARTICIPATION_SPEC.md` | The Grow sub-screen and the creative process (seeds, crossroads, rings, ledger) |
| `DATA_MODEL.md` | Database, rights, content packs, device storage |
| `TECH_SPEC.md` | Architecture, mobile and admin implementation, APIs, sync, testing |
| `DESIGN.md` | Tokens, map style, components, screen layouts, copy |
| `BUILD_PLAN.md` | Milestones and acceptance criteria |

If docs conflict: PRODUCT_SPEC wins on behavior, DATA_MODEL on schema, AUDIO_SPEC on sound, and TECH_SPEC on implementation.

---

## 1. Concept

InTell augments a place rather than replacing it. You walk, the place speaks, and you keep your eyes on the world. The interface is deliberately minimal: a map and three small sub-screens.

### Core vocabulary
| Term | Meaning |
|---|---|
| **Grove** | A polygon holding one connected storyline (e.g. "Salt Marsh" at Farmington Bay) |
| **Fragment** | A narrated audio clip anchored to a GPS point, which plays within its trigger radius |
| **Root / Branch / Leaf** | Fragment tiers: narrative weight, trigger priority and marker style (ADR 0003). A **Root Start** opens a thread of the story; a **Root End** (`is_ending`) closes one. |
| **Prerequisites** | What must be heard before a fragment is revealed: groups that are all required, where any one member satisfies a group (AND of ORs). Fragments with no prerequisites are revealed from the start. Taking one route never closes another; the story is non-linear. |
| **Heard** | Completed: the listener has played the whole fragment. Partly played fragments are "started" and unlock nothing. |
| **Surroundings** | Randomly arranged sound effects and beds that match where you are (birds at the refuge, wind in the aspens, a city murmur downtown) |
| **Soundtrack** | Music tied to geofenced zones and Groves that shifts with which part of the story you're in |
| **Hush** | A moment when all synthetic sound fades and a whispered "Listen." invites you to hear what's really there |
| **Seed** | Anything a listener offers the story: an idea, a noticed detail, an answer, a memory, a recorded sound |
| **Ring** | A story season: planting → crossroads → writing → Listening Day release |
| **Crossroads** | A place-gated vote that decides the story's direction and becomes canon |
| **Ledger** | The shared credits listing everyone who grew each Ring |

### Success for the board (details in TECH_SPEC §9)
Taking part (visits, fragments heard) · depth (share reaching Branches and Leaves) · return (6-month device cohorts) · contribution (seeds, votes, grown seeds) · the ownership-return effect (do planters return more?) · optional connection check-in. InTell never claims clinical or screen-time outcomes.

---

## 2. Principles (these break ties)
1. **The environment is the interface.** A map, a bottom bar with three buttons, and a dark playing overlay. No feeds, search, lists of nearby content, streaks, badges, percentages or push notifications.
2. **You have to be there.** New fragments play only on site. Crossroads votes happen only on site. Seeds are born on site. The Journal remembers; it doesn't replace the visit.
3. **Sound accompanies reality.** Surroundings are mixed low, with Hush moments; wildlife calls never play on the speaker (AUDIO_SPEC §1).
4. **People write and record everything that plays.** No AI-generated text, narration, music or sound.
5. **The story belongs to everyone who walks it.** Visible lineage, collective credit, shared canon (PARTICIPATION_SPEC).
6. **Consent and rights gate playback.** Revocation reaches every phone on the next sync.
7. **Offline first.** Downloaded Groves work with no signal.
8. **Anonymous by default.** No accounts. Location never leaves the phone. The Journal stays on the phone.
9. **Accessible by default.** Transcripts, screen readers, large text, reduced motion, accessible play.
10. **Protect sensitive places.** Protected fragments never expose coordinates.

---

## 3. Scope

### 3.1 Mobile app (iOS and Android, native, Expo)
| Area | v1 |
|---|---|
| Launch | Static splash → branded Replaceplace animation (≤ 2.5 s, skippable; full only on cold start) → first-launch welcome (2 cards + location explainer) |
| Home: Map | Muted base map; user puck; Grove polygons; Root, Branch and Leaf markers by unlock state; crossroads fork glyphs (if the anchor was heard); your private seed sprouts; recenter button; a session status chip; **bottom bar: Journal · Grow · Settings** |
| Story playback | Proximity triggering with tier priority; tap-to-play in range; QR for protected fragments; accessible play; new-revision replay; the dark playing overlay; lock-screen controls |
| Surroundings | Generative ambience from zones or land cover; time, season and route aware; wildlife-safe |
| Soundtrack | Zone- and grove-based cues with story-state conditions and stems; crossfades |
| Hush | Periodic silence with a "Listen." cue (setting, default on) |
| Journal | Tree, Story and Visits views; Moments; Echo playback; field notes (JOURNAL_SPEC) |
| Grow | Rings, crossroads, questions, your seeds and their lineage, canon, the Ledger, Story Circles, check-in (PARTICIPATION_SPEC) |
| Settings | Language; text size; audio mixer (Story, Music, Surroundings); Hush on/off; arrival chime; playback speed; headphones tip; accessibility (accessible play, reduced motion, high-contrast markers); downloads; privacy (what we collect, Delete my data, Reset device ID, journal export and import); credits (story, music, surroundings, community sounds); about |
| Offline | Grove packs (manifest, narration, music, tiles); region pack (ambience library, landcover grid) |

### 3.2 Admin web app (Next.js)
Sites and approvals · Grove editor (polygon, fragment tree, story order, gap hints) · revisions and rings · story bible (threads, characters) · audio asset library with rights and loudness · ambience profiles, layers and zones · music zones, cues and stems with a condition builder · **Listening Simulator** (AUDIO_SPEC §8) · seed inbox, ring board, crossroads builder, ledger review, Listening Day release (PARTICIPATION_SPEC §7) · contributors and consents · dashboard · printable Grove guide · archive export · audit log · staff.

### 3.3 Not in v1
AI generation of any kind; public accounts or social features; public display of seed text; leaderboards or gamification; push notifications; in-app payments; turn-by-turn navigation; binaural or 3D audio; bar-synced musical transitions; other pathways and events (beyond the Story Circle links).

---

## 4. The home map

```
┌────────────────────────────────┐
│     ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮         │
│     ┆  Salt Marsh        ┆        │
│     ┆   ◉      ●   ⑂     ┆        │   ◉ Root  ● Branch  • Leaf  ⑂ open Crossroads
│     ┆      •      ◎      ┆        │   ◎ in range (halo)   🌱 your seed (private)
│     ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯         │
│              ⦿                  │
│                          [⌖]   │
│  ( Exploring Salt Marsh · Stop ) │
│ ┌─────────┬─────────┬─────────┐ │
│ │ Journal │  Grow   │Settings │ │
│ └─────────┴─────────┴─────────┘ │
└────────────────────────────────┘
```
- **Marker states:** unheard (outline); heard (filled); updated (accent halo); in range (pulsing halo, static with reduced motion); retired (hidden).
- **Never drawn:** unmarked fragments (they still trigger), protected fragments (QR only), unrevealed fragments, and any sound or music zones. Sound is felt, not mapped.
- **Marker sheet:** tier, title, distance; **Play** if in range (or accessible play), otherwise "Walk here to listen"; for heard fragments, "Open in Journal"; **🌱 Plant a seed here** when inside the Grove and a Ring is planting.
- **Grove sheet:** name, premise, access notes, the current Ring line ("Ring 2 is planting"), **Download · 84 MB**, and "How it works."
- **Fork sheet:** the crossroads prompt and options, voting if place-gated conditions are met (PARTICIPATION_SPEC §3.2).

---

## 5. Core flows

### 5.1 Exploring
1. Entering a Grove polygon (or tapping Play in range, or scanning a QR code) starts a session. Location runs in the background only during the session. Surroundings and soundtrack fade in.
2. **Trigger:** two consecutive confirmed fixes inside the radius of a revealed, not-yet-heard fragment (or a heard one with a newer current revision). Then the chime and haptic, ducking, and the fragment plays. If your seed grew into this revision, the growth moment plays first (PARTICIPATION_SPEC §2.4).
3. **Playing overlay:** a dark screen with the title, tier, credit and pause, reading "Look up. We'll keep playing." After the fragment ends: an afterglow of 8 s, newly revealed markers fade in with "Something new has appeared nearby", and an optional **🌱 Plant a seed here** that disappears after 20 s.
4. **Priority:** Root > Branch > Leaf, then nearest. Queue at most one.
5. **End:** 15 minutes after leaving all Groves, after 3 hours, or by tapping Stop. The visit is recorded in the Journal.

### 5.2 Journal (JOURNAL_SPEC)
Tree, Story and Visits views per Grove; a Moment per fragment with Echo (off site) or full replay (on site); field notes; character cards; canon.

### 5.3 Grow (PARTICIPATION_SPEC)
The Ring status, crossroads, questions, your seeds, canon, the Ledger, Story Circles and the check-in.

---

## 6. Functional requirements (summary; details in the linked specs)
| ID | Requirement |
|---|---|
| FR-1 | Fragments live inside their Grove polygon; prerequisites are in the same Grove and acyclic (DATA_MODEL §4, ADR 0003) |
| FR-2 | Unlock: a fragment is revealed when every one of its prerequisite groups has at least one member the device has **completed** (played to the end). No prerequisites ⇒ revealed from the start. Revealed fragments stay revealed. Only revealed fragments trigger. |
| FR-3 | Trigger: 2 consecutive fixes within 60 s, inside the radius, accuracy ≤ radius + 15 m; defaults Root 30 m, Branch 25 m, Leaf 20 m |
| FR-4 | Visibility `marked` / `unmarked` / `protected`; protected plays via QR only (`https://{LINK_DOMAIN}/f/{code}`), matched by hash |
| FR-5 | A heard fragment auto-replays once only when a newer current revision exists |
| FR-6 | Accessible play (setting): play any revealed fragment within 150 m, or anywhere inside the Grove when location is unavailable |
| FR-7 | Surroundings and soundtrack per AUDIO_SPEC §3–4; Hush per §5; buses and ducking per §2.3 |
| FR-8 | Wildlife calls never on the speaker; muted in nesting months; site approval can ban speaker wildlife sounds |
| FR-9 | Everything except seed upload, votes and status sync works offline after download |
| FR-10 | Sync deletes any local asset not in the current manifests (revocation), including Journal audio |
| FR-11 | The Journal is device-local; Echo off site is narration only (JOURNAL_SPEC) |
| FR-12 | Seeds, crossroads, rings, Ledger and moderation per PARTICIPATION_SPEC |
| FR-13 | Location is never sent to the server; seeds and votes send anchor ids only |
| FR-14 | Anonymous `device_id` (UUID v4, secure storage, resettable); age gate stored per device |
| FR-15 | Events per TECH_SPEC §8; no coordinates or free text in telemetry |
| FR-16 | Publish checklist per DATA_MODEL §11; packs rebuilt on publish, revocation and schedule |

---

## 7. Non-functional requirements
| Area | Requirement |
|---|---|
| Performance | Map interactive ≤ 2.5 s after the animation on a mid-range 2022 Android; narration starts ≤ 500 ms after trigger confirmation; 300 markers pan smoothly |
| Battery | 60 minutes exploring with all three layers < 12% battery (balanced → high accuracy near candidates; audio decode cached) |
| Memory | < 150 MB during full-mix playback |
| Offline | Downloaded Groves fully functional; region library downloaded on Wi-Fi |
| Accessibility | WCAG 2.2 AA equivalent; markers announced ("Branch: Salt and Feathers, 40 meters, not yet heard"); 200% text; 48 dp targets; reduced motion; transcripts for all heard fragments |
| Privacy | No third-party analytics or ad SDKs; Sentry with PII scrubbing and no location; children's-privacy approach and seed terms reviewed by counsel before launch |
| Platforms | iOS 16+, Android 9+ (API 28+) |
| Languages | en, es UI strings; content per language |

---

## 8. Content guidelines (story and sound teams)
- Root 2–4 minutes; Branch 1–3 minutes; Leaf 20–90 seconds. Leave ≥ 40 m between fragments. Set `story_order` and a `gap_hint` for every fragment.
- Narration must not direct people off trail, toward wildlife, or into restricted areas.
- Prefer site field recordings for surroundings; license everything (AUDIO_SPEC §6).
- Use `protected` for culturally sensitive sites, nests and private land. Stories involving Indigenous knowledge need documented community permission and credit as the community specifies.
- Weave several seeds per revision; credit them; write a public change note.

---

## 9. Open questions (product owner decides; Cursor should not guess)
1. Store name, bundle ID and link domain (placeholders: "InTell by Replaceplace", `org.replaceplace.intell`, `intell.replaceplace.org`).
2. Map tiles: MapTiler (hosted, a paid plan is likely needed for offline) or self-hosted Protomaps PMTiles.
3. The brand animation file (Lottie or Rive), its length and its palette.
4. Ring cadence and the staff hours per Ring (recommended: 2 Rings per Grove per year in Year 1).
5. Who triages seeds, and the target turnaround to "Read" (recommended 14 days).
6. Spanish at launch: UI only, or UI plus narration.
7. Accessible play on or off by default.
8. Whether sound seeds go live in v1 or after the first Ring.
9. The audio engine choice, pending the M1 spike (AUDIO_SPEC §2.2).
