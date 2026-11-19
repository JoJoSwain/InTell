# InTell — Journal Spec (v2)

The Journal is where you revisit story fragments you've already heard. It's one of the three sub-screens opened from the map's bottom bar.

---

## 1. What the Journal is for

Most apps would make this a playlist. That would undercut the whole project: if every story can be replayed anywhere, there's no reason to go back to the place. The Journal has to do four things at once:

1. **Remember.** Give back what you heard, where and when, so the memory stays attached to the place.
2. **Make the whole story legible.** Show how your pieces fit into a larger story, and where the gaps are, without spoiling it.
3. **Pull you back outside.** Every gap, every new version and every new branch should point to a physical spot.
4. **Show your part in it.** Your seeds, your votes, and the fragments they grew into.

And it must be fast to open, calm to look at, and quick to close.

### Design rules
- **Nothing unheard is ever playable or readable here.** Unheard parts appear only as silhouettes and gap hints written by the story team.
- **Off-site replay is narration only (an "Echo").** On site, a replay includes the full mix (surroundings and soundtrack for that spot). This keeps the place the best way to experience the story, without punishing anyone who wants to remember it at home.
- **No percentages, scores or completion meters.** The shape of the tree carries that information more gently.
- **Local and private.** The Journal lives on the phone (DATA_MODEL §14). Exporting it to move phones is opt-in.
- **Every visual has a list equivalent** for screen readers.

---

## 2. Structure

```
Journal (sheet)
├─ Grove cards (one per grove you've visited, most recent first)
│   └─ Grove page
│       ├─ [ Tree ]   ← default
│       ├─ [ Story ]
│       └─ [ Visits ]
│           └─ Moment (fragment detail)  ← reachable from all three
└─ (footer) Characters you've met · Export / import journal
```

### 2.1 Journal home: Grove cards
Each card shows:
- A small generated **tree glyph** for that grove: your actual tree shape, with heard nodes filled and unheard nodes as faint outlines. Same algorithm as §3.1, thumbnail size, no labels.
- The grove name and "Last visit Sat, Nov 22 · dusk".
- At most **one** status line, in this priority order:
  1. "New growth since your last visit" (new branches or leaves published that would now be revealed for you)
  2. "A new version is waiting at {fragment}"
  3. "A Crossroads is open here" (you heard its anchor but haven't voted)
  4. "Your seed grew"
  5. otherwise nothing

There's no badge count on the bottom bar. A single small dot on the Journal button appears only for status 1, 2 or 4.

Empty state: "Stories you hear will gather here," above an illustration of a single seed.

---

## 3. The Grove page

### 3.1 Tree view (default)
A living diagram of the story's structure, drawn bottom-up like a real tree: Roots at the base, Branches above them, Leaves at the tips.

- **Layout:** a deterministic tidy-tree layout (Reingold–Tilford style) from the pack's parent links, with Roots along the bottom and children ordered by `storyOrder`. Rotate it so it grows upward. Pinch to zoom and pan when large.
- **Nodes:**

| State | Look |
|---|---|
| Heard | Filled in its tier color, with the title label |
| Heard; newer version waiting | Filled, with an accent halo and a small ⟳ |
| Partially heard (< 80%) | A ring filled to the progress value |
| Revealed, not heard | Outline only, with the title (you've seen it on the map) |
| Not yet revealed | Faint silhouette dot, **no title**; shown only one level beyond what you've revealed, so the tree hints at more without exposing its full size |
| Retired | Heard ones stay, dashed, labeled "retired from the Grove" |
| Crossroads | A small fork glyph on the branch where a crossroads is anchored. After it's decided: "Listeners chose: {outcome}" |
| Grown from your seed | A tiny sprout mark beside the node (private to you) |

- **Rings as growth bands:** faint horizontal bands behind the tree, labeled at the edge ("Ring 1 · First Thaw", "Ring 2 · The Long Thaw"). Nodes sit in the band of the ring that introduced them, so you can see the story grow over time.
- Tapping a node opens its **Moment**. Tapping a silhouette shows its gap hint ("Something waits farther along the dike") with a **Show on map** button that closes the Journal and centers the map on the nearest revealed point. It never shows the hidden fragment's location.
- **Accessibility:** the screen reader version is an indented list ordered by `storyOrder`, with states read aloud.

### 3.2 Story view: the storybook
The story as continuous prose, in the canonical order the writers set (`storyOrder`), not the order you happened to walk.

- **Heard fragments:** the transcript in the `transcript` style, with a small tier marker and title in the margin. Tap a paragraph to open its Moment.
- **Unheard fragments:** a **gap** block in muted italic showing the `gap_hint` ("A part of the story waits near the old pump house."), with a **Show on map** link. Protected fragments' hints never mention location.
- **Characters you've met:** a horizontal row at the top. A character card appears when you first hear a fragment that `introduces` them. Each card shows the public name, a short bio, and the fragments where they appear (heard only).
- **Canon from listeners:** where a decided crossroads sits in the story order, show a block: "At this crossroads, listeners chose: *Mara stays.* (Ring 2, 431 votes)", plus "You chose: Mara stays" if you voted.
- **Echo: listen to your story so far.** One button plays every heard fragment in story order, **narration only**, with a 2 s pause and a soft page-turn chime between them, skipping gaps. Lock-screen controls work. It's designed for the drive home or before bed: audio-first, phone in pocket.
- **Language:** a heard fragment shows the language version you heard, with a toggle to read the other if it exists.

### 3.3 Visits view: your history with this place
A plain reverse-chronological list, one entry per exploring session:
```
Sat, Nov 22 · dusk · 48 min
  ◉ The Night the Water Rose
  ● Salt and Feathers
  • The Heron's Eye
  🌱 You planted 1 seed · ⑂ You voted at a Crossroads
```
- Time of day and duration come from `visits`. No path or coordinates are stored, by design.
- A visit's header can carry your private **visit note** (field notes, §5).
- Footer: "You've visited Salt Marsh 4 times since September." A fact, not a streak.

---

## 4. The Moment (fragment detail)

The heart of the Journal. One scrolling screen:

1. **Header:** tier label, title, "Heard Sat, Nov 22 at dusk · Salt Marsh".
2. **Place thumbnail:** a small static map of the fragment's spot rendered from the offline tiles, with a **Show on map** link. Protected fragments show the grove outline only.
3. **Player:**
   - Off site: **Echo** (narration only), labeled "Echo · the full experience plays at this spot."
   - Inside the grove: **Replay here**, the full mix.
   - Always plays the version you heard. If a newer one exists: "This part of the story has grown. Version 3 is waiting at this spot." **No preview.**
4. **Transcript** (`transcript` style; text scales; selectable for copying).
5. **Credits:**
   - Writer, narrator and other roles with license lines.
   - "Shaped by listener seeds from Ana P., River, and 23 others" (approved credit names only).
   - If one of your seeds grew into this version: "Your seed is part of this." The seed's text or a playback of your voice seed (from your phone) sits beside it.
6. **Version history:** the versions you've heard, with dates and their public change notes. Older heard versions can be replayed as Echoes, as long as they're still playable (consent).
7. **Field note** (private): see §5.
8. **Seeds you planted here:** each with its status timeline (Planted → Read → Sprouting → Grown). A **Plant a seed about this** button (PARTICIPATION_SPEC §2) appears while the ring is open.
9. **Characters in this fragment** (met ones only), as chips linking to their cards.

If the fragment's consent has been revoked, the Moment shows only the title, date and "This story is no longer available," with no transcript, audio or credits. The Journal never keeps content the contributor has withdrawn.

---

## 5. Field notes (private)
- One optional note per Moment and per Visit: text up to 1,000 characters, **or** a voice note up to 60 s (recorded with the large hold-to-record button the Grow screen also uses).
- Stored only on the phone (`field_notes`) and included in the encrypted journal export.
- **Share as a seed:** turns the note into a seed (pre-filled; the user picks the seed kind and confirms the terms). This is the gentlest path from private reflection into the creative process.
- Copy: "Notes are just for you. They never leave your phone unless you share them as a seed."

---

## 6. Behaviors and edge cases
| Case | Behavior |
|---|---|
| New revision published for a heard fragment | Node gets ⟳; the Moment shows "waiting at this spot"; the map marker shows the updated state; the next proximity visit auto-plays it once |
| A fragment's parent is retired | Children stay reachable in the Tree under a dashed parent |
| Consent revoked | Content removed at sync; a placeholder remains (§4) |
| A crossroads outcome makes new revisions playable | Treated as new growth; the status line on the Grove card |
| The user deletes the app | Journal lost unless exported; Settings → Privacy explains this plainly |
| The user resets the device ID | Journal stays; seed statuses no longer sync (seeds are tied to the old ID). Warn before resetting |
| Many groves | Grove cards virtualized; tree rendering memoized per pack version |

---

## 7. Implementation notes
- Data: computed from SQLite `heard`, `visits`, `field_notes`, `my_seeds`, `my_votes`, `met_characters`, plus the installed grove pack. No network needed.
- Tree rendering with `react-native-svg` (or Skia if performance demands), using a pure layout function `packages/shared/journal/treeLayout.ts` (unit-tested; the same function generates the card thumbnails).
- Story view: a virtualized list (FlashList) of blocks `{type:'fragment'|'gap'|'canon'|'cast'}` built by `buildStorybook(pack, heard, votes)` in `packages/shared/journal/storybook.ts`.
- Echo playback goes through the `AudioEngine` narration path with music and surroundings buses muted; it registers lock-screen metadata "Echo · {grove}".
- Analytics (no content): `journal_opened`, `moment_opened`, `echo_played {scope: fragment|storybook}`, `show_on_map_tapped`, `field_note_saved` (no text), `field_note_shared_as_seed`.
