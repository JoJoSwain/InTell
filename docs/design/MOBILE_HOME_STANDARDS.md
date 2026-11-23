# InTell mobile home screen: design standards

**Decided:** 2026-11-22 design session (Jordan and Ashley, with Claude).
**Status:** source of truth for the DESIGN.md mobile rewrite and the M5b brief. Where this document and DESIGN.md §1–§4 disagree, this document wins until DESIGN.md is rewritten.
**Follow-up decisions (same night):** the plan-drawing and blueprint map (§3A), the buffer union as the real grove boundary, with locked fragments and islands included (§4.1), web lines that show the logic chain, with arrows for cross-grove links (§6), and a still Reduce Motion pulse (§5.3).
**Changes on 2026-11-23, after the first look on a phone:**
- The grove's outline itself now fades gently, replacing the outward halo (§4.3).
- Markers have solid centers (§5.1).
- Every unexplored pulse is the Root brick red (§1.2, §5.3).
- Every ring is 2.5 pt (§5.1).

**Living references:** the home-screen canvas, the Color Lab and the decision worksheet (links in the session notes; ask Claude to re-share). The canvas holds both base-map directions (§3) side by side.

Units: **pt** means iOS points or Android dp. **ft** means real-world feet on the ground.

---

## 1. Brand foundation

### 1.1 Palette (worksheet 1.1: the brand palette)
From the Replaceplace brand guide: InTell's pathway color is **Deep blue `#295E7C`**, the guide's beige is `#F7F0E5`, and the warm brand colors are ochre, amber, clay and brick. The typeface is Questrial.

| Token | Day | Night | Use |
|---|---|---|---|
| `bg` | `#F7F0E5` | `#10171C` | App background |
| `surface` | `#FFFDF9` | `#18222A` | Sheets, chips |
| `text` | `#1B2A33` | `#EDE6DA` | Body text, ink linework, marker rings (day) |
| `textMuted` | `#55636B` | `#A7B0B5` | Secondary text |
| `border` | `#E2D8C8` | `#2A3640` | Dividers |
| `primary` | `#295E7C` | `#7FB3CF` | Embark, primary actions |
| `onPrimary` | `#FFFFFF` | `#10171C` | Text on primary |
| `accent` | `#4D654E` | `#8FAE91` | Changed-fragment pulse, "now playing" (brand forest green) |

Every text pair passes WCAG AA by day and night (checked in the Color Lab).

### 1.2 Tier colors (worksheet 1.2: all warm, tuned)
A dark-to-light ramp, so the tiers stay distinct for every type of color vision.

| Tier | Day | Night |
|---|---|---|
| Root | deep brick `#763329` | brick `#B9574A` |
| Branch | brand amber `#B06511` | bright amber `#E3953F` |
| Leaf | light ochre `#DBAA5A` | pale ochre `#F6E0AE` |

**Not used on the home map** (changed 2026-11-23). Every unexplored marker pulses in the Root brick (§5.3), and tiers differ by size. These colors stay reserved for other screens, such as the Chronicle.

### 1.3 Typography (worksheet 1.4)
- **Questrial** (Google Fonts, OFL, single weight) for the brand voice: grove names, sheet titles, welcome and empty-state headlines, the bottom buttons, and the grove-name chip.
- **The system font** (San Francisco or Roboto) for reading: body, captions, settings and transcripts. It supports Dynamic Type and must hold at 200%.
- There's no bold Questrial. Hierarchy comes from size and color, and Questrial is never faked bold.

### 1.4 Dark mode (worksheet 1.7)
- The app switches to night colors **at the region's sunset and sunrise**, the same moment the story's Day/Night window flips (`timeWindow.ts`).
- Settings → Appearance: **"Match the story's day and night"** (default) or **"Follow my phone"**.

---

## 2. Home screen

### 2.1 The only constants
1. **The map** (full screen; §3).
2. **The bottom buttons:** Chronicle, Embark and Journal (§2.2).
3. **Settings:** a three-line menu icon, top right.
4. **The InTell wordmark,** top left. It uses the supplied artwork (SVG preferred) and is never typed or redrawn (brand rule). *Needed from Ashley.*
5. **The grove name,** top center, **only while the listener is inside a grove.** Tapping it opens the grove sheet, which holds **Stop exploring**.

Everything else is transient:
- **Recenter** appears only after the listener pans away from their location.
- The Embark route bar, teaser pop-ups and the playing overlay appear only while in use.

### 2.2 Controls

| Element | Spec |
|---|---|
| Chronicle, Journal | Floating pills, 48 pt tall, 16 pt side padding, Questrial 16, radius 24 |
| Embark | Raised pill, 60 pt tall, 26 pt side padding, Questrial 19, radius 30, sits 8 pt higher than the side pills; `primary` fill, `onPrimary` text |
| Bottom row | 16 pt from the screen edges, 34 pt from the bottom, 8 pt minimum gap (it must fit a 360 pt-wide phone) |
| Grove-name chip | 40 pt tall, Questrial 17, radius 20, with a small down chevron |
| Settings | 44 pt circle, three 2 pt lines |
| Top row | 56–58 pt from the top of the screen (below the status bar) |

- **Plan-drawing styling (§3A):** day chips and buttons are white with a 1 pt ink outline and a flat offset shadow (0 2 pt, ink 18%). Night is `#163447` with a white 85% outline.
- **Aerial styling (§3B):** beige 94% chips with a soft shadow by day, and `#18222A` 92% at night.

---

## 3. Base map: **plan drawing by day, blueprint by night** (decided)

### 3A. Plan drawing (day) and blueprint (night)
This style follows planning and landscape-architecture drawings:
- **Line weight carries the hierarchy:** the grove boundary is heaviest, then roads, then water edges, then hairlines.
- **The surroundings recede** into pale linework, so the grove reads as the site.
- **Color comes in flat, pale washes.**

**Day (Google cloud map styling, roadmap type):**

| Feature | Style |
|---|---|
| Land | Paper `#F8F5EF` |
| Natural areas and marsh | Wash `#E6EBDD` |
| Water | Fill `#D6E6EE`, 1 pt edge `#7FA3B6`, plus offshore contour hairlines `#A9C3D1` / `#B8CEDA` (0.6 pt) where an overlay allows |
| Major roads | White band about 12 pt, casing `#5E6266` (band plus 1.5 pt each side) |
| Minor roads and dikes | White band about 6.5 pt, casing `#8E9296` |
| Buildings | Fill `#EFEBE3`, 0.75 pt hairline `#6F7479` |
| Trails | 1 pt dashed hairline `#55636B` (3/2.5) |
| Labels | Small, letterspaced, grey (`#6B7075`; water labels `#6F92A5`); Google's label font (can't be changed) |
| Hidden | All POIs and businesses, parking, gas stations (the no-cars rule) |

**Night (blueprint):**

| Feature | Style |
|---|---|
| Ground | `#1E4560` |
| Natural areas | `#224D69` |
| Water | `#183B51`, white edge at 70% |
| Roads | White casing at 60%, with a band in the ground color (double-line roads) |
| Buildings | White hairlines at 70% |
| Labels | White at 55% |

**Feasible with Google styling:** every fill, edge color, stroke weight and visibility above.
**Not feasible:** hatching, drawn tree canopies, hand-drawn texture, a custom label font.
**Optional later:** a per-grove illustrated plan overlay (Ashley's artwork as a ground overlay inside the grove boundary).

### 3B. Aerial photo (not chosen; kept on the canvas for reference)
- Google **satellite** map type with **no labels layer**, so there are no business or parking icons.
- **Night:** the photo under a deep-blue veil, `rgba(16,23,28,0.45)`. The veil strength is tunable.
- **Limits:** no brand styling of the photo. Markers and lines need light treatments to read on busy imagery.

---

## 4. Groves

### 4.1 Shape: the union of buffers
- The grove is the **union of a circle around every fragment:** Root **250 ft**, Branch **150 ft**, Leaf **100 ft**.
- **No blending:** arcs meet at sharp points, drawn as true circular arcs with miter joins.
- **Merge distances** (two fragments join only if their circles overlap):

  | Pair | Merge distance |
  |---|---|
  | Two Leaves | 200 ft |
  | Leaf and Branch | 250 ft |
  | Two Branches | 300 ft |
  | Branch and Root | 400 ft |
  | Two Roots | 500 ft |

  Farther apart, the grove forms islands (allowed; see below).
- **This shape is the grove's real boundary (decided).** It's calculated when a release publishes, from the grove's published fragments, so staff no longer draw grove polygons. It decides when a session starts and where grove-boundary music cues play. Embark still arrives at the opening root (ADR 0006).
- **Locked fragments count (decided):** they're part of the grove as unexplored territory, so every listener sees the same grove. Retired fragments don't count.
- **Islands are allowed (decided):** a grove can be several separate pieces. They're still one grove: the grove's soundtrack, name and session cover every piece.
- **Needs a write-up:** an ADR plus DATA_MODEL and pack changes, since the boundary becomes derived data (Lane A).

### 4.2 Outline and fill

| | Plan day | Blueprint night | Aerial day / night |
|---|---|---|---|
| Line | Ink `#1B2A33`, 2.25 pt, dash 8/5 | White, 2.25 pt, dash 8/5 | White 90% / 85%, 1.5 pt, dash 6/4 |
| Caps / joins | Butt / miter | Butt / miter | Butt / miter |
| Fill | White 50% | `#2B5D7B` 50% | White 10% / 8% |

### 4.3 Grove pulse: the outline breathes (changed 2026-11-23)
- **The outward halo is gone.** On a phone it looked choppy and drew the eye.
- **Instead, the dashed outline itself fades, very gently,** on the shared beat:
  - its opacity eases from **100% down to 60% and back** once a second, on a smooth ease-in-out curve
  - it's brightest at the start of each beat, in step with the marker pulses (§7)
- **The fill doesn't change.** Only the outline's opacity moves.
- **Tunable:** Jordan chose 60% after seeing it on a phone. The useful range runs from 85% (subtler) to 50% (stronger).
- **Reduce Motion:** a steady outline at 100%.

---

## 5. Markers

### 5.1 Form
- **Every marker is a ring with a solid center** (changed 2026-11-23), so street names and other map details never show through:
  - **Day:** an ink `#1B2A33` ring with a white `#FFFFFF` center.
  - **Night:** a white ring with a `#163447` center, the night button color. A white center would swallow the white ring.

  | Tier | Diameter | Ring width |
  |---|---|---|
  | Root | 22 pt | 2.5 pt |
  | Branch | 16 pt | 2.5 pt |
  | Leaf | 12 pt | 2.5 pt |

- **Tap target:** 48 pt for every marker.
- **Every ring is 2.5 pt** (changed 2026-11-23; the Leaf was 2 pt).
- **Tier shows by size,** and by how far the pulse grows. QR (physical) markers look identical. Their sheet says "Scan the code here to listen."

### 5.2 States

| State | Ring | Pulse |
|---|---|---|
| **Unexplored** (unlocked, in window, not completed for the current contingency) | Full strength | **Root brick** (`#763329` day, `#B9574A` night), at its tier's size |
| **Changed** (unheard Story Contingency, playable now) | Full strength | **Forest green** (`accent`), at its tier's size |
| **Completed** | Full strength | None (still) |
| **Locked** (prerequisites not met; out of window looks the same for now) | **Faded but opaque:** ring `#B0B4B8` by day (ink at 35% on white) and `#687B87` at night (white at 35% on `#163447`), with the usual solid center | None (still) |

### 5.3 The pulse
- **Once per second (60 a minute).** A ring 2 pt wide starts at the marker's diameter + 6 pt, then **expands and fades** (opacity 0.95 → 0, ease-out):

  | Tier | Expands to | Relative to Root |
  |---|---|---|
  | Root | ×1.8 | 100% |
  | Branch | ×1.48 | 60% |
  | Leaf | ×1.24 | 30% |

- **Color** (changed 2026-11-23): the **Root brick for every tier.** Branch and Leaf pulses are brick too, at their own sizes. Changed fragments pulse forest green.
- **Only unexplored and changed markers pulse.**
- **Reduce Motion (decided):** the pulse becomes a **still brick ring** (green for changed), at the pulse's starting size. Unexplored and completed markers stay easy to tell apart without motion.
- **Performance:** animate only the markers on screen (target: 300 markers panning smoothly on a mid-range Android).

---

## 6. Story web (connector lines)
- **What the lines mean (decided):** each line is a real link in the logic chain, a prerequisite writers set in the admin. A line from A to B means hearing A counts toward unlocking B. The web draws itself from the story data, with no extra authoring.
- **Cross-grove links (decided):** a link to a fragment in another grove draws from the marker toward that fragment and **ends in an arrow about 100 ft past this grove's boundary**. The length is ground distance, so it scales with zoom. Each grove shows its own end of the link.
  - *Defaults:* the arrowhead is an open chevron about 8 pt wide in the line's color and weight, drawn solid. If the other grove is closer than 100 ft, the arrow stops at its edge.
- **Dashed lines** (dash 4/3) between linked fragments: **Root–Branch 1.5 pt**, **Branch–Leaf 1 pt**.
- **Strength:**

  | Link | Plan day | Night (all) | Aerial day |
  |---|---|---|---|
  | Into reachable fragments | Ink 85% | White 80–85% | White 90% |
  | Into locked fragments | Ink 45% | White 45–50% | White 55% |

- **Lines stop at marker edges:** each end is trimmed from the marker's center by Root **14 pt**, Branch **11 pt**, Leaf **9 pt**, so lines never show inside rings.
- Lines draw **under** the markers and above the grove fill.
- **Aerial versions only:** lines get a faint dark shadow (1 pt, black 60%) to read on imagery.

---

## 7. Motion: one shared clock
- **One 1-second clock** drives everything: the marker pulses and the grove outline's fade share every beat.
- **No other ambient motion on the home map.**
- **Reduce Motion** stops all of it.
- Nothing flashes faster than 3 times per second.

---

## 8. Open items
1. **Locked vs out-of-window:** both are faded today (worksheet 3.3; for example, a small sun or moon badge).
2. **Mock correction:** a locked fragment's lines must include at least one link from an unexplored fragment (a heard-only prerequisite would have unlocked it).
3. **Not reached yet:** Embark card and journey passage (4.2, 4.4), welcome cards and location explainer (6.3, 6.4), portrait style (5.6), app name and icon (1.6), and the remaining unstarred worksheet rows.

## 9. Assets needed from Ashley
- The **InTell wordmark**, SVG preferred.
- Later, if chosen: per-grove illustrated plan overlays (§3A).
