# InTell — Design Spec (v2, partly superseded)

> **Superseded in part by ADR 0004 (2026-11-20).** §5 (admin) is updated for M3, and the token values in §1.1 and the type scale in §1.3 still apply. Everything else (token *uses* such as `seed` and the crossroads `accent`, §1.2 map style, §1.4 haptics and UI sounds, §2 copy, §3 components, §4 screens, §6 checklist items about the tree, storybook and Echo) still describes v2 and will be rewritten with Ashley (Creative Director) before M5. Until then, ADR 0004 wins: Google Maps online (ADR 0002); markers at 100% when playable and 35% when locked or out of their time window, colored by tier; a teaser pop-up for locked markers; Chronicle (bottom left), **Embark** (center; ADR 0005) and Journal (bottom right) with Settings top right; a fragment with an unheard Story Contingency pulses slowly (a still ring with reduced motion) and its tap shows the change teaser; no car or parking imagery or copy; no Grow, Rings, Crossroads, Ledger, Fork sheet or seeds; no Play button for a first listen (narration starts on arrival, one fragment at a time).

**The design goal:** the phone is a quiet companion. Sound does the work; the map orients; every screen is easy to leave. Screen-level detail for the Chronicle and the Journal will live in their own specs (rewritten before M8 and M9). This doc holds the system they share.

---

## 1. Tokens (`apps/mobile/src/ui/tokens.ts`; mirrored in admin Tailwind and the Google cloud map style)

### 1.1 Color
| Token | Light | Dark (overlay, night) | Use |
|---|---|---|---|
| `bg` | `#F6F2EA` | `#121410` | Backgrounds, map land |
| `surface` | `#FFFFFF` | `#1C1F19` | Sheets, bottom bar |
| `text` | `#1F2419` | `#E9E6DC` | Body |
| `textMuted` | `#5B6152` | `#A3A596` | Secondary, trails |
| `primary` | `#3F5B3A` | `#9DBB8F` | Groves, primary buttons |
| `onPrimary` | `#FFFFFF` | `#121410` | |
| `root` | `#6B4A2B` | `#C9A27A` | Root markers and nodes |
| `branch` | `#3F5B3A` | `#9DBB8F` | Branch markers and nodes |
| `leaf` | `#7A9A3A` | `#C3D98A` | Leaf markers and nodes |
| `accent` | `#B4632E` | `#D9935F` | Updated halo, now playing, crossroads |
| `seed` | `#A07D2E` | `#E0C27A` | Your seeds, the growth moment |
| `water` | `#3D6E7A` | `#86B3BE` | Map water, links |
| `border` | `#DDD6C7` | `#2E3229` | |
| `warning` | `#8A5A00` | `#E3B45C` | Content notes |
| `danger` | `#9B2C2C` | `#E68A8A` | Destructive actions |

- Tier is shown by **size + glyph + label**, never color alone: Root 18 px with a trunk glyph, Branch 13 px with a fork glyph, Leaf 9 px with a leaf glyph. A high-contrast setting adds a 2 px `text` outline.
- Test every text/background pair for WCAG AA contrast.

### 1.2 Map style
Paper land (`bg`), `water` blue, trails as dashed `textMuted` lines, roads de-emphasized, **no POI icons**, labels only at zoom ≤ 14, plus a night variant. Groves: 10% `primary` fill, 2 px dashed outline, and the name in serif at 13 px. **Ambience and music zones are never drawn.**

### 1.3 Typography
Headings in Source Serif 4 (bundled); UI in the system font (Dynamic Type).
| Token | Size / line height | Weight |
|---|---|---|
| `display` | 30/36 | Serif 600 |
| `title` | 22/28 | Serif 600 |
| `heading` | 18/24 | Sans 600 |
| `body` | 17/26 | Sans 400 |
| `bodySmall` | 15/22 | Sans 400 |
| `caption` | 13/18 | Sans 500 |
| `transcript` | 19/30 | Serif 400 |

### 1.4 Space, shape, motion, haptics, sound
- Spacing: 4, 8, 12, 16, 24, 32, 48. Screen padding 20; sheet radius 20; pill radius 999. Targets ≥ 48 dp; markers have a 48 dp hit area.
- Motion: 200 ms ease-out. A reveal scales 0.6 → 1 and fades over 600 ms. The halo pulses at 1.6 s. Reduced motion → static.
- Haptics: arrival (light), reveal (soft success), seed planted (light). Nothing else.
- UI sounds (bundled): arrival chime, reveal chime, growth motif (2 s, seed moments only), page-turn (Echo storybook). All on the `ui` bus; the arrival chime can be turned off.

### 1.5 Load animation
The Replaceplace brand animation, ≤ 2.5 s, on `bg`; tap to skip; cold start only. Reduced motion → final frame for 600 ms. A placeholder wordmark fade until the brand file arrives (`assets/animation/`).

---

## 2. Voice and copy
Warm, plain, short, second person. Use the in-world words: Grove, Root, Branch, Leaf, Seed, Ring, Crossroads, Ledger, Hush, Echo. Avoid "Indigeny," "augmentation" or academic terms in the UI. Invite rather than instruct. Never promise outcomes.

| Key | English |
|---|---|
| `welcome.1` | Stories live in places. Walk to them to hear them. |
| `welcome.2` | The story grows with what you plant. Free, no account, works offline. |
| `location.why` | InTell uses your location to play each story when you reach it. Your location stays on your phone. |
| `map.outside` | Head to a Grove to begin. |
| `map.walkHere` | Walk here to listen · {{distance}} |
| `map.plant` | Plant a seed here |
| `playing.lookUp` | Look up. We'll keep playing. |
| `playing.changed` | This part of the story has changed. |
| `reveal.toast` | Something new has appeared nearby. |
| `hush.cue` | (spoken) Listen. |
| `bar.journal` / `bar.grow` / `bar.settings` | Journal / Grow / Settings |
| `bar.exploring` | Exploring {{grove}} · Stop |
| `journal.empty` | Stories you hear will gather here. |
| `journal.echoLabel` | Echo · the full experience plays at this spot |
| `journal.waiting` | This part of the story has grown. A new version is waiting at this spot. |
| `journal.unavailable` | This story is no longer available. |
| `journal.notesPrivate` | Notes are just for you. They never leave your phone unless you share them as a seed. |
| `grow.empty` | Visit a Grove to help it grow. |
| `grow.planting` | {{ring}} is planting · {{days}} days left |
| `grow.seedGrew` | Your seed grew into “{{fragment}}”. Walk there to hear it. |
| `grow.status.planted/read/sprouting/grown/resting/hidden` | Planted / Read by the story team / Sprouting / Grown / Resting, and may wake in a later Ring / This seed couldn't be used |
| `grow.ledger` | {{ring}} was grown by {{count}} listeners |
| `crossroads.locked` | Hear this part of the story here to choose. |
| `crossroads.closed` | Listeners chose: {{outcome}} |
| `growth.narrator` | (recorded per Grove) This part of the story grew from seeds planted by people who walk here, including you. |

---

## 3. Components (`src/ui/`)
`Screen`, `Text`, `Button`, `Sheet` (snap points), `BottomBar`, `StatusChip`, `MarkerSheet`, `GroveSheet`, `ForkSheet`, `PlayingOverlay`, `PlayButton` (88 dp with progress ring), `Scrubber`, `HoldToRecord` (96 dp; level ring; haptic at start and stop; a screen reader alternative of tap to start / tap to stop), `KindChips`, `StatusPill`, `LineageTimeline`, `TreeCanvas` (Journal), `StorybookBlock` (fragment, gap, canon, cast), `CharacterCard`, `RingBanner`, `LedgerList`, `MixerSliders`, `RatingScale` (5 labeled radios), `DownloadButton`, `Toast`, `EmptyState`, `ErrorState`.
Map markers are MapLibre style layers, not React components.

---

## 4. Screen inventory
| Screen | Spec |
|---|---|
| Splash + animation, Welcome, location explainer | §1.5 and PRODUCT_SPEC §3.1 |
| Map with Marker, Grove and Fork sheets | PRODUCT_SPEC §4 |
| Playing overlay (always dark) | Title, tier, credit, 88 dp pause, ±15 s, speed, "Look up." After 10 s idle, everything but the title and pause dims to 30%. After the end: afterglow, then a 20 s "Plant a seed here" button. A "Show map" link. |
| Hush state | The map stays as is; the status chip reads "Hush · listening" with a small Skip |
| Journal: home, Grove (Tree, Story, Visits), Moment, Characters | JOURNAL_SPEC §2–5 |
| Grow: home, Plant (text), Terms, Ledger, Canon | PARTICIPATION_SPEC §5 |
| Settings and sub-pages | PRODUCT_SPEC §3.1. The Audio page holds the Story, Music and Surroundings sliders, Hush on/off, arrival chime and a headphones tip ("Headphones give the full soundscape. On speaker, wildlife sounds stay off.") |

---

## 5. Admin design
shadcn/ui, light theme, same tokens. Distances in feet. Sidebar groups:
- **Story:** Groves, Characters, Story Notes, Releases
- **Media:** Audio, Images
- **Sound** (M4): Ambience, Music, Simulator
- **Journal** (M9): Inbox, Questions
- **Ops:** Regions, Dashboard, Audit, Staff

Status badges: Draft gray, Scheduled blue, Published green, Failed red, Retired gray outline, Unpublished red outline. Revisions show a **Story Contingency** or **Story Correction** chip; versions show **Day** or **Night** chips. Fragments with unreleased edits show an "Unreleased changes" marker.

---

## 6. Accessibility checklist (each release)
- [ ] Markers announced with tier, title, distance and state; reveals announced
- [ ] Journal tree has a list equivalent; the storybook reads as continuous text
- [ ] Hold-to-record has a tap-to-start/stop alternative
- [ ] Every heard fragment has a transcript; Echo has lock-screen controls
- [ ] The accessible trigger starts fragments automatically within 35 ft of their point (it needs location)
- [ ] 200% text, reduced motion, contrast tests pass
- [ ] The mixer is operable by screen reader (adjustable sliders with values)
