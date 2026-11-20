# InTell — Product Spec (v3)

> **InTell** is Replaceplace's app for **InDigeny**, its story pathway. It brings forward **Indigeny**, the embodied struggle between **Earth** (the physical environment) and **World** (cultural practice, history, social norms), so people explore themselves and their relationship with Place through stories met in real places. Narrated story fragments, sound effects and an adaptive soundtrack play as you move through the place itself.

v3 incorporates ADR 0004 (product realignment, 2026-11-20).

**Doc map** (read in this order):
| Doc | Covers |
|---|---|
| `PRODUCT_SPEC.md` (this file) | Purpose, principles, scope, home map, flows, requirements |
| `AUDIO_SPEC.md` | The three audio layers, the engine, mixing, Hush moments |
| `JOURNAL_SPEC.md` | *(superseded; to be rewritten before M8 as the Chronicle spec)* |
| `PARTICIPATION_SPEC.md` | *(superseded; to be rewritten before M9 as the Journal spec)* |
| `DATA_MODEL.md` | Database, content packs, device storage |
| `TECH_SPEC.md` | Architecture, mobile and admin implementation, APIs, sync, testing |
| `DESIGN.md` | Tokens, map style, components, screen layouts, copy |
| `BUILD_PLAN.md` | Milestones and acceptance criteria |
| `adr/0004-product-realignment.md` | The decisions behind v3 |

If docs conflict: PRODUCT_SPEC wins on behavior, DATA_MODEL on schema, AUDIO_SPEC on sound, and TECH_SPEC on implementation. ADR 0004 beats any older text it contradicts.

---

## 1. Purpose and concept

**The core experience is being there.** A person walks a real place and meets the story where it happens: a root, branch or leaf fragment at a GPS point, inside sound effects and a soundtrack shaped by geofenced zones. The place's physical reality (Earth) meets the story's characters, events and moods (World) in the listener's body. Everything in InTell serves that encounter. The **Chronicle** (looking back) and the **Journal** (contributing thoughts) are supporting features and never substitute for being on site.

InTell augments a place rather than replacing it. You walk, the place speaks, and you keep your eyes on the world. The interface is deliberately minimal: a map, two sub-screens and Settings.

**Geographically flexible.** Nothing in InTell is specific to one place. Groves can be authored anywhere with GPS and phone signal. The first grove is the Farmington Bird Refuge (the George S. and Dolores Doré Eccles Wildlife Education Center).

### Core vocabulary
| Term | Meaning |
|---|---|
| **Story** | One ongoing story. Every grove is part of it. |
| **Grove** | A place where fragments cluster, drawn as a polygon (e.g. "Salt Marsh" at Farmington Bay). Staff may call it a "site"; the word never appears in the app. |
| **Fragment** | A narrated audio clip anchored to a GPS point that plays within its trigger radius (or by scanning a physical marker) |
| **Root / Branch / Leaf** | Fragment tiers: narrative weight, trigger priority and marker color (ADR 0003). A **Root Start** opens a thread; a **Root End** (`is_ending`) closes one. |
| **Prerequisites / logic chain** | What must be completed before a fragment unlocks: groups that are all required, where any one member satisfies a group (AND of ORs). Prerequisites may be in other groves (plot bridges). Taking one route never closes another. |
| **Completed** | The listener played the fragment's current version to the end, on site. Partly played fragments are "started" and unlock nothing. |
| **Physical marker** | A fragment unlocked by scanning a QR code on a physical object at the spot. It appears on the map and follows the logic chain. |
| **Teaser** | One authored line per fragment, shown when a locked marker is tapped. It pairs a place cue with a story cue. |
| **Day / Night** | Every fragment version, sound layer and music cue is tagged Day or Night, set by the region's sunrise and sunset. |
| **Story Contingency / Story Correction** | A new revision that changes the story (listeners must hear it again before new fragments unlock) or only fixes it (no reset) |
| **Surroundings** | Randomly arranged sound effects and beds that match where you are, by geofenced zone |
| **Soundtrack** | Music tied to geofenced zones and story state |
| **Hush** | A moment when all synthetic sound fades and a whispered "Listen." invites you to hear what's really there |
| **Chronicle** | Your record of the story you've encountered, navigated by character, with replay of fragments you've completed |
| **Journal** | Where you share thoughts (plot, characters, what you noticed) that Replaceplace's writers draw on |
| **Release** | A batch of content published together (staff-side only) |

### Success measures (details in TECH_SPEC §9)
Taking part (visits, fragments completed) · depth (share reaching branches and leaves) · return (6-month device cohorts) · contribution (Journal entries, ideas that grew) · optional connection check-in. These follow the business plan's learning measures; InTell never claims clinical, wellbeing or screen-time outcomes.

---

## 2. Principles (these break ties)
1. **The place comes first.** Every feature serves the on-site encounter. Nothing lets a first listen happen off site.
2. **The environment is the interface.** A map, Chronicle and Journal buttons, a center button (to be decided), Settings, and a dark playing overlay. No feeds, search, lists of nearby content, streaks, badges, percentages or push notifications.
3. **In situ first.** New fragments play only on site. A fragment enters the Chronicle only after it has been completed on site.
4. **Sound accompanies reality.** Surroundings are mixed low, with Hush moments; wildlife calls never play on the speaker (AUDIO_SPEC §1).
5. **Replaceplace makes everything that plays.** Writing, narration, music and sound effects are produced by Replaceplace staff, for creative control and quality. No AI-generated text, narration, music or sound. Listeners' Journal entries inform the writers; they're never played, shown or credited.
6. **Show where the story leads, not what it says.** Locked fragments are visible on the map; only their teaser is shown until they're completed.
7. **Earth and World meet in the body.** Fragments and teasers point to real sounds, textures and things in the place, and tie them to the story.
8. **Anonymous by default.** No listener accounts. Location never leaves the phone. Story progress stays on the phone.
9. **Accessible by default.** Transcripts, screen readers, large text, reduced motion, accessible play, image alt text.

---

## 3. Scope

### 3.1 Mobile app (iOS and Android, native, Expo)
| Area | v1 |
|---|---|
| Launch | Static splash → branded Replaceplace animation (≤ 2.5 s, skippable; full only on cold start) → first-launch welcome (2 cards + location explainer) |
| Home: Map | Google base map (online); user puck; grove polygons; root, branch and leaf markers (100% playable now, 35% locked or out of window); recenter button; a session status chip; **Chronicle** (bottom left), **center button (TBD)**, **Journal** (bottom right); **Settings** (top right) |
| Story playback | Proximity triggering with tier priority; tap-to-play in range; QR scan for physical markers; accessible play; Day/Night version selection; replay after a Story Contingency; the dark playing overlay; lock-screen controls |
| Surroundings | Generative ambience from zones or land cover; Day/Night and month aware; wildlife-safe |
| Soundtrack | Zone- and grove-based cues with story-state conditions and stems, Day/Night; crossfades |
| Hush | Periodic silence with a "Listen." cue (setting, default on) |
| Chronicle | Character cards (portrait, growing summary, groves, related fragments); completed fragments with replay per completed time version; related locked fragments with their teasers (spec rewritten before M8) |
| Journal | Write or record thoughts about the story, private to Replaceplace staff; see what your ideas grew into; optional check-in (spec rewritten before M9) |
| Settings | Text size; audio mixer (Story, Music, Surroundings); Hush on/off; arrival chime; playback speed; headphones tip; accessibility (accessible play, reduced motion, high-contrast markers); downloads; privacy (what we collect, Delete my data, Reset device ID); staff sign-in (preview mode); about |
| Downloads | Grove packs (manifest, narration, music, images) and the region pack (ambience library, landcover grid) are downloaded before a walk so playback is smooth with the screen locked. The base map is online only. |

### 3.2 Admin web app (Next.js, hosted)
Staff sign-in and invites · regions · groves (polygon, access notes, fragments, prerequisites across groves, story order, teasers, physical markers with printable QR codes) · revisions (Day/Night versions, transcripts, Story Contingency or Correction) · releases (batch publish, scheduling, the publish checklist) · Story Notes (threads, private character notes, Indigeny notes) · characters (public intro, portrait, card lines) · audio and image library with loudness and format checks · ambience profiles, layers and zones · music zones, cues and stems with a condition builder · **Listening Simulator** (AUDIO_SPEC §8) · Journal inbox and questions (M9) · dashboard · archive export (revisions, transcripts, Story Notes and metadata, so the content is preserved independently of the app) · audit log · staff.

### 3.3 Not in v1
AI generation of any kind; listener accounts or social features; public display of Journal entries; public credits for listeners; rings or story seasons; crossroads votes; leaderboards or gamification; push notifications; in-app payments; turn-by-turn navigation; binaural or 3D audio; bar-synced musical transitions; offline maps; languages other than English for content.

---

## 4. The home map

```
┌────────────────────────────────┐
│                          [⚙]   │
│     ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮         │
│     ┆  Salt Marsh        ┆        │
│     ┆   ●      ●   ◌     ┆        │   ● playable now (100%)  ◌ locked or out of window (35%)
│     ┆      ◌      ◎      ┆        │   ◎ in range (halo)      colors: root · branch · leaf
│     ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯         │
│              ⦿                  │
│                          [⌖]   │
│  ( Exploring Salt Marsh · Stop ) │
│ ┌─────────┬─────────┬─────────┐ │
│ │Chronicle│  (TBD)  │ Journal │ │
│ └─────────┴─────────┴─────────┘ │
└────────────────────────────────┘
```
- **Marker states:** playable now (100% opacity, tier color); locked or outside its time window (35%, tier color); in range (pulsing halo, static with reduced motion); completed and changed-since-completed states are decided in DESIGN before M5; retired (hidden). Physical markers use a distinct glyph.
- **Never drawn:** sound or music zones. Sound is felt, not mapped.
- **Tapping a locked or out-of-window marker** opens a small text pop-up with its teaser only: no title, transcript or audio.
- **Tapping a playable marker** opens the marker sheet: tier, title, distance in feet; **Play** if in range (or accessible play), otherwise "Walk here to listen"; for a physical marker, "Scan the marker to listen"; for completed fragments, "Open in Chronicle".
- **Grove sheet:** name, premise, access notes, website link, and download size.

---

## 5. Core flows

### 5.1 Exploring
1. Entering a grove polygon (or tapping Play in range, or scanning a physical marker) starts a session. Location runs in the background only during the session. Surroundings and soundtrack fade in.
2. **Trigger:** two consecutive confirmed fixes inside the radius of a fragment that is unlocked, has a version for the current time window, and isn't completed for its latest Story Contingency. Then the chime and haptic, ducking, and the fragment plays. If the listener's Journal idea grew into this revision, a short growth moment plays first.
3. **Physical markers:** scanning the QR code opens InTell at the fragment. If it's unlocked and has a version for the current window, it plays; otherwise its teaser pop-up appears.
4. **Playing overlay:** a dark screen with the title, tier and pause, reading "Look up. We'll keep playing." After the fragment ends: an afterglow of 8 s, then newly unlocked markers brighten to 100% with "Something new has opened nearby".
5. **Priority:** Root > Branch > Leaf, then nearest. Queue at most one.
6. **End:** 15 minutes after leaving all groves, after 3 hours, or by tapping Stop.

### 5.2 Chronicle (spec rewritten before M8)
Character cards are the front door: a portrait, a summary that grows with each completed fragment, the groves the character appears in (open question: all groves, or only those where met), and their fragments. Completed fragments replay anywhere, narration only off site, for each time version completed on site. Related locked fragments show their teaser. After a Story Contingency, the superseded version leaves the Chronicle until the new one is completed on site.

### 5.3 Journal (spec rewritten before M9)
Listeners write or record thoughts about the story. Replaceplace's writers read them and author new content informed by them (Journal-informed authoring). Entries are private to staff. Listeners can see when an idea of theirs grew into the story.

---

## 6. Functional requirements (summary; details in the linked specs)
| ID | Requirement |
|---|---|
| FR-1 | Fragments live inside their grove polygon. Prerequisites may reference fragments in any grove and must be acyclic story-wide (DATA_MODEL §4, ADR 0003 as amended by ADR 0004). |
| FR-2 | **Unlock:** a fragment is unlocked when every prerequisite group has at least one member the device has **completed for that member's latest Story Contingency** (any time version). No prerequisites ⇒ unlocked from the start. Unlocked fragments stay unlocked, even after a later contingency on a prerequisite. |
| FR-3 | **Trigger:** 2 consecutive fixes within 60 s, inside the radius, with accuracy within a tolerance tuned in M6 field tests. Radius 15–35 ft, default 35 ft for every tier. |
| FR-4 | **Visibility** `standard` / `physical`. Physical fragments play only via QR scan (`https://{LINK_DOMAIN}/f/{code}` on replaceplace.com), matched by hash, never by proximity; a scan alone suffices, prerequisites and time windows still apply. |
| FR-5 | **Story Contingency** makes a completed fragment not-completed until its new revision is completed on site; it then triggers again on approach. **Story Correction** carries completion forward with no replay. |
| FR-6 | **Day / Night:** the current window comes from sunrise and sunset for the grove's region. A fragment plays the version for the current window; a fragment without one shows at 35%. The version is chosen at playback start. |
| FR-7 | **Accessible play** (setting): a Play button for an unlocked standard fragment when the listener is **within 35 ft of its GPS point**, without waiting for the two-fix trigger. It needs location; there's no fallback when location is unavailable. It counts as on site. Physical markers still need a scan. |
| FR-8 | Surroundings and soundtrack per AUDIO_SPEC §3–4 (geofenced zones, never GPS points); Hush per §5; buses and ducking per §2.3. Sound and music never gate the story: only root, branch and leaf fragments are in the logic chain. |
| FR-9 | Wildlife calls never on the speaker; muted in nesting months. A grove's wildlife-speaker setting (off by default) silences all surroundings on the phone speaker inside that grove unless it's turned on. |
| FR-10 | Playback works with the screen locked from downloaded packs. The base map, Journal submission and sync need signal. |
| FR-11 | Sync deletes any local asset not in the current manifests |
| FR-12 | The Chronicle replays only versions completed on site; off site it plays narration only |
| FR-13 | Location is never sent to the server; Journal entries send anchor ids only |
| FR-14 | Anonymous `device_id` (UUID v4, secure storage, resettable); age gate stored per device |
| FR-15 | Events per TECH_SPEC §8; no coordinates or free text in telemetry |
| FR-16 | Content reaches phones only through published releases (DATA_MODEL §10–11) |
| FR-17 | **Staff preview mode:** a staff member signed in on the phone sees draft content from a chosen draft release, for that device only |

---

## 7. Non-functional requirements
| Area | Requirement |
|---|---|
| Performance | Map interactive ≤ 2.5 s after the animation on a mid-range 2022 Android; narration starts ≤ 500 ms after trigger confirmation; 300 markers pan smoothly |
| Battery | 60 minutes exploring with all three layers < 12% battery (balanced → high accuracy near candidates; audio decode cached) |
| Memory | < 150 MB during full-mix playback |
| Connectivity | Groves are assumed to have phone signal. Audio is downloaded in advance; the map streams. |
| Accessibility | WCAG 2.2 AA equivalent; markers announced ("Branch, 30 feet, locked"); 200% text; 48 dp targets; reduced motion; transcripts for completed fragments; alt text for portraits |
| Privacy | No third-party analytics or ad SDKs; Sentry with PII scrubbing and no location; children's-privacy approach and Journal terms reviewed by counsel before launch |
| Platforms | iOS 16+, Android 9+ (API 28+) |
| Languages | English content and UI strings; all strings through i18n so languages can be added later |
| Units | Feet and miles in the app and admin; metres in storage |

---

## 8. Content guidelines (story and sound teams)
- Root 2–4 minutes; Branch 1–3 minutes; Leaf 20–90 seconds.
- **Spacing:** keep trigger circles apart. Two fragments at the 35 ft default need 70 ft between them; the admin warns on overlap.
- **Teasers:** pair a **place cue** (a sound, texture or thing that's really there, or the object to scan) with a **story cue** (a character, event or mood). Never give away an unheard title or event. If a fragment exists only by day or only by night, hint at it. Examples: "The cattails lean east here. Ada always said that meant someone was coming." · "Find the post with the heron carved into it. Someone has been leaving marks beside it."
- **Indigeny note:** for every fragment, record in Story Notes the Earth (the physical feature), the World (the cultural or fictional element meeting it) and the Body (what the listener is invited to do or notice).
- **Day and Night:** decide per fragment whether it has a Day version, a Night version or both. One-window fragments are a deliberate tool; a one-window prerequisite blocks listeners at the other time of day.
- **Story Contingency vs Correction:** use Contingency when the story changes (it resets listeners for what comes next); use Correction for fixes.
- Narration must not direct people off trail, toward wildlife, or into restricted areas.
- Prefer field recordings from the actual place for surroundings. All audio is produced by Replaceplace (AUDIO_SPEC §6).
- Stories involving Indigenous knowledge or traditions need appropriate permission and qualified participation (business plan, Appendix C).

---

## 9. Open questions (product owner decides; Cursor should not guess)
1. Store name and bundle ID (placeholders: "InTell by Replaceplace", `org.replaceplace.intell`). Link domain: `LINK_DOMAIN` on replaceplace.com (proposed `intell.replaceplace.com`).
2. The brand animation file (Lottie or Rive), its length and its palette.
3. The center home-screen button.
4. Character cards: list every grove a character appears in, or only groves where the listener met them?
5. How completed and "changed since you heard it" markers look (DESIGN, before M5).
6. Whether the Chronicle hints that another time version exists.
7. Listener progress backup (device-only today): optional account sync or export/import? Decide before M5.
8. Children and the Journal: confirm the under-13 rule and the children's-privacy approach with counsel before M9.
9. Who triages Journal entries, and the target turnaround to "read" (recommended 14 days).
10. Accessible play on or off by default.
11. The audio engine choice, pending the M1 device tests (ADR 0001).
12. A printable grove guide (transcripts and a route map) as the business plan's non-phone way to take part: in v1 or later?
