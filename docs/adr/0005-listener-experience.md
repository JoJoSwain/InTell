# ADR 0005: Listener experience decisions: Embark, story changes, character cards and progress

## Status
**Accepted**, 2026-11-20. Decided by the product owner (Jordan "JoJo" Swain) with the architect (Claude), resolving ADR 0004's open questions. Amends ADR 0004 (decisions 2, 15 and 19), PRODUCT_SPEC, DATA_MODEL, TECH_SPEC, BUILD_PLAN and AGENTS.md. Where those docs still disagree, **this ADR wins** until they're updated.

## Context
ADR 0004 left seven product questions open: character-card groves, how a changed fragment looks, Day/Night hints in the Chronicle, where listener progress lives, children's Journal privacy, the center home-screen button, and a printable guide. The product owner settled all but one in a review on the evening of 2026-11-20.

## Naming (correction to ADR 0004's Purpose)
- **InTell** is both the app and Replaceplace's **story pathway**.
- **Indigeny** is the **phenomenon** that all of Replaceplace's pathways explore. It is not a pathway.
- **Replaceplace** is the business's official typed name.
- Tagline: **"Find your place in story."**

## Decisions

### 1. Listener progress stays on the phone, and travels with the phone's backup
Completion, unlocks and Chronicle state stay on the device. There are no listener accounts and no export or import. The app stores its database where the operating system's backup includes it: iCloud on iOS, Google backup on Android. So restoring a phone from backup restores InTell progress.
- Settings says plainly that progress lives on this phone and travels with its backup.
- Switching between iOS and Android, or having backups turned off, loses progress. That's accepted for v1.
- Revisit optional sync after the first field season.
- Tested in M5 and in the M12 field test.

### 2. Character cards
A character card shows:
- a **picture**: the character's portrait from the image library, with alt text. It's **required to release a character**.
- the **back story**: the existing `public_intro`, labelled "Back story" in the admin.
- **one home grove**, chosen by the writers as the grove the character is most associated with.

Cards **don't list every grove** a character appears in, so there's no spoiler question. Other card details, such as card lines and related fragments, are settled in the Chronicle spec before M8. This supersedes the "groves they appear in" part of ADR 0004 decision 15.

### 3. When the story changes at a fragment the listener completed
A fragment whose current **Story Contingency** the listener hasn't heard yet **pulses gently on the map** until they hear the new version in situ.
- The pulse is slow, about once per second, and never flashes faster than three times per second. With the phone's Reduce Motion setting on, it becomes a still indicator, such as a ring.
- Tapping the marker shows a **change teaser**: a short line the writers compose for that contingency, shown in place of the usual teaser.
- No push notifications (PRODUCT_SPEC principle 2).

### 4. The Chronicle hints at the other time version
When a fragment has both a Day and a Night version and the listener has heard only one, the Chronicle shows an **other-time hint**: a short line the writers compose on the **unheard version**, in the story's voice. For example: *"After dusk, River speaks of something else."* A revision with both versions needs a hint on each before it can be released.

### 5. The center button is **Embark**
**Embark** helps a listener reach the beginning of a grove's story by walking, cycling or public transit.
- **Destination:** the **nearest grove's opening**, its first root fragment in story order (the first paragraph of the chapter). "Nearest" is straight-line distance from the listener's current location to each grove's opening point. Tapping any grove on the map offers the same choices, so the listener isn't limited to the nearest one.
- **Modes:** **On foot, By bike, By transit.** There is no driving mode (decision 6).
- **Routes are drawn on InTell's own map**, not handed to another app. They come from Google's **Routes API (Compute Routes)**.
- **The `embark` relay.** The phone calls an InTell edge function. The function looks up the grove's opening point itself, so it can only route to groves, calls Google with a server-only key, and returns the route line, distance, duration and transit steps.
- **Privacy:** the listener's location is sent only when they ask for a route. It is **never stored or logged**, on the phone or the server. A per-device daily request cap and a Google quota cap control cost.
- **Arrival:** when the listener reaches the opening root, the route clears and its narration begins on its own (ADR 0004 decision 28).
- **Journey passages:** after a mode is picked, an optional short passage that the writers compose for that grove and mode is shown, linking that way of arriving to the opening root. It's a light touch, and a missing passage never blocks a release.
- There is no spoken turn-by-turn guidance, because it would compete with narration (one voice at a time). A Refresh button recalculates the route.
- Google labels walking and cycling routes as beta and requires a notice to users. The walk and bike cards carry a short, gentle note.

### 6. Cars are not part of the experience
Replaceplace deliberately promotes arriving on foot, by bike or by public transit: the journey is part of the adventure. The app has no driving routes, parking information or other car-related content. **Arrival logistics (parking, bike racks, stops, terrain) are left to the listener.** The grove `access_notes` field is removed entirely, which amends ADR 0004 decision 2.

### 7. No printable guide
Everything lives on the phone. The archive export (M11) is kept so content is preserved independently of the app.

## Still open
- **Children's Journal privacy:** entries from children under 13 need counsel review before M9. The age gate stays.

## Consequences
- **M3e** (a short follow-up after M3d, brief in `docs/briefs/M3e-story-fields.md`) adds:
  - `characters.home_grove_id`
  - `fragment_revisions.change_teaser`
  - `revision_versions.other_time_hint`
  - the `grove_journeys` table
  - removal of `groves.access_notes`
  - new release checks
  - pack format **schema 3**
  - each grove's opening point in the pack index
  - the admin fields for all of the above
- **M5:**
  - the Embark button and card, the `embark` relay, and the Google Routes API key setup
  - the pulsing changed-fragment marker and the change-teaser pop-up
  - storing the device database in a backed-up location
- **M8:** the character card (picture, back story, home grove) and the other-time hints in the Chronicle.
- **M12:** confirm that a backup restore onto a new phone brings progress back.
- **Costs:** Routes API requests are billed per route with a monthly free allowance; set daily quota caps. See also the ADR 0002 note on Map IDs.
