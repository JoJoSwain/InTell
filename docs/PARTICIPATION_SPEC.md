# InTell — Participation Spec: Growing the Story Together (v2)

**Goal:** make shaping the story the most exciting part of InTell, so that people who walk a Grove feel the story is *theirs*, collectively, and keep coming back to see what they grew.

**Constraint we keep:** people write and record every word that plays as story. There is no AI generation. Listeners plant, choose, notice, record and gather. The story team weaves. Staff time is the scarce resource, so every mechanic is designed to make weaving efficient and visible.

---

## 1. Why most "submit your idea" features fail, and what we do instead

| Failure pattern | InTell's answer |
|---|---|
| **Black box:** you submit and never hear back | **Lineage:** every seed has a visible life (Planted → Read → Sprouting → Grown) and a destination you can walk to |
| **No consequence you can feel** | **"Your seed grew" moment:** at the exact spot, before the fragment plays, the narrator tells you the story grew from seeds including yours |
| **Disconnected from the experience** | **Place-born:** seeds are planted *in the Grove*, anchored to the fragment you just heard, often by voice, without looking at the screen |
| **Winner-takes-all popularity contests** | **Crossroads** are rare, staff-framed and place-gated; the losing paths often survive as hidden Leaves ("the road not taken") |
| **Only the loudest or most literary participate** | **Many doors:** a vote, a ten-second sound, a one-line "I noticed…", a question answered, an in-person story circle |
| **Ownership feels individual and competitive** | **The Ledger and Canon:** credit is collective ("Ring 2 was grown by 212 listeners"), and decisions become canon everyone shares |
| **Endless, shapeless feedback** | **Rings:** a rhythm of planting, choosing, writing and releasing, ending in a public Listening Day |

### Pillars
1. **Place-born.** You can only plant where the story lives. Inspiration comes from the ground.
2. **Visible consequence.** Every contribution has a traceable outcome.
3. **Collective canon.** Decisions and credit belong to everyone who walks the Grove.
4. **Rhythm and ritual.** Story seasons with a shared release moment, online and in person.
5. **Many doors, one story.** Low-effort and high-effort participation are equally honored.
6. **Safe and fair.** Anonymous, moderated, kid-aware, culturally careful, and abuse-resistant.

---

## 2. Seeds: the unit of contribution

A **seed** is anything a listener offers the story. Seeds are planted *at* a place and grow (or rest) over a Ring.

### 2.1 Kinds of seed
| Kind | Prompt shown | Typical input | What it can grow into |
|---|---|---|---|
| `next` | "What happens next?" | Voice or text | Plot in a new Branch or revision |
| `character` | "Who else lives in this story?" or "Tell us about {character}" | Voice or text | A new character, or a new side of a known one |
| `noticed` | "What did you notice here?" | Voice or text, often short | Sensory detail woven into narration ("the light on the brine flies at dusk") |
| `answer` | One of the Grove's open **Questions** | Voice or text | Canon answers to story mysteries |
| `memory` | "Do you have a real memory of this place?" | Voice or text, plus optional contact | Routed to the **oral-history process**: staff follow up for proper consent and recording; may become a storyteller fragment |
| `sound` | "Record a sound from right here" | 10–30 s field recording | Part of the Grove's **surroundings** (ambience) library |

### 2.2 Planting on site: eyes up, hands free
- **Where you can plant:** inside a Grove during an exploring session, or within 7 days afterward (text only, from the Grow screen, attributed "planted after your visit").
- **Hold to plant:** the playing overlay (after a fragment ends) and the marker sheet both offer a large **🌱 Plant a seed here** button.
  1. Hold to record a voice seed. Release to stop. Up to 90 s (30 s for `sound`).
  2. A gentle chime, then a single question sheet: "What kind of seed?" with large kind chips. You can skip it; voice defaults to `noticed`.
  3. The credit name is remembered from last time and editable. The terms checkbox appears on first use only.
  4. Done. Back to the map within 3 taps.
- **Anchoring:** the device snaps the seed to the nearest revealed fragment within 60 m (or the playing one). Otherwise it anchors to the Grove. **Raw coordinates are never sent.**
- **Text later:** a voice seed can get a typed addendum within 7 days. A `noticed` seed planted by voice can stay voice only.
- Seeds can be planted offline. They upload when connectivity returns (voice files via a signed upload URL).

### 2.3 What happens to a seed (lineage)
```
Planted ──► Read ──► Sprouting ──► Grown
   │           │          │
   │           └──► Resting ("not this time; seeds can wake in a later Ring")
   └──► Hidden (moderation; user sees "This seed couldn't be used")
```
- **Read:** a member of the story team has read or listened to it. Target: within 14 days during a planting window.
- **Sprouting:** linked (`seed_links`) to a draft revision, a sound asset, a crossroads option or a question answer.
- **Grown:** the linked target has published. The seed shows where it grew: "Grew into *Salt and Feathers* (Ring 2) · at the marsh boardwalk".
- **Resting** isn't rejection. Writers can wake resting seeds in later Rings, and the status says so.
- The listener sees statuses in **Grow → Your seeds** and on the Journal Moment. A single dot on the Grow button signals a change. No push notifications.

### 2.4 The "Your seed grew" moment (the emotional peak)
When a listener walks into range of a fragment whose **current revision** has a `seed_links` entry for one of *their* seeds (known on the device: `my_seeds.links_json` synced from `GET /my-seeds`):
1. A distinctive **growth motif** plays (a 2 s musical signature unique to InTell).
2. The grove narrator's recorded `narrator_growth_cue`: *"This part of the story grew from seeds planted by people who walk here, including you."*
3. Then the fragment plays as usual.
4. On the map, your sprout mark at that spot turns into a small tree glyph (private to you).
5. The Journal Moment shows "Your seed is part of this," with your seed beside it.

This happens only once per seed. It's never visible to anyone else, and it requires no account.

### 2.5 Seed terms (plain-language; counsel to review)
> You're offering an idea, memory or sound to a shared story. Replaceplace writers may use, adapt, combine or not use it. If we use it, we'll credit the name you give (or "a listener"). We won't publish your words or voice as-is unless you tick the boxes below. Please don't include anyone's private information.
> ☐ You may quote my words in the story. ☐ (18+ only) You may use my recorded voice in the story. ☐ (sound seeds) You may use my recording in InTell's soundscape (a free, permanent license, with credit).

---

## 3. Mechanics beyond seeds

### 3.1 Questions the Grove is asking
- Staff-written open questions attached to a fragment or character: "Who left the lantern on the dike?" or "What did the heron see that night?"
- A question appears in Grow and in the Moment **only after you've heard its anchor fragment** (`requires_heard`), so the question lands when you're curious.
- Answers are `answer` seeds. A question closes with a **canon answer** published in a later revision, and the seeds that shaped it are credited.

### 3.2 Crossroads: choose the story's direction, on site
- A few times per Ring, the story team frames a decision at a fragment: *"Should Mara cross the dike tonight, or wait for the water to fall?"* There are 2–3 options, written by staff and often drawn from seeds (`seed_links.crossroads_option_id`).
- **Place-gated voting:** you can vote only (a) after hearing the anchor fragment, (b) physically within `vote_radius_m` of it, (c) while the crossroads is open. One vote per device, which can be changed until it closes.
- An optional teaser asset (narrated framing) plays when you reach it.
- The map shows a fork glyph at the anchor while the crossroads is open, but only for listeners who have heard the anchor.
- **Results are hidden until it closes.** No live tallies, so there's no bandwagoning. A moderator confirms the tally, the outcome becomes canon ("Listeners chose: Mara stays."), and revisions or music cues with `requires_outcome_option_id` / `outcome` conditions become playable.
- **The road not taken:** writers may later publish the losing path as an unmarked Leaf. Finding it is a reward for exploring.
- **Kids can vote.** Voting collects no personal information, so under-13 listeners get real agency (§6).
- **Integrity:** device attestation (App Attest / Play Integrity) is required to vote. There's a per-device uniqueness check. Votes from devices first seen less than 10 minutes before voting are flagged for review.

### 3.3 Rings: the story's seasons
| Phase | Typical length | What listeners see |
|---|---|---|
| **Planting** | 6–8 weeks | "Ring 2 · The Long Thaw is planting. 312 seeds so far." Questions open. A writer's note (text and optional voice) sets the theme. |
| **Crossroads** | Overlaps the last 3 weeks of planting | Fork glyphs on the map |
| **Writing** | 4–6 weeks | "The story team is writing Ring 2." Seeds move to Sprouting. |
| **Release (Listening Day)** | One day | New revisions publish at `publish_at`. A Story Circle gathering happens in person at the Grove. The Ledger updates. |

- **Recommended cadence for Year 1:** 2 Rings per Grove per year, so a two-person team can keep up. One release aligns with Replaceplace Day (March 21), as in the business plan.
- The Rings appear as growth bands in the Journal's Tree view, so you can literally see the story's age.

### 3.4 The Ledger: shared credit for the whole story
- In **Grow → The Ledger**, for each Ring:
  - "Ring 2 · The Long Thaw was grown by 212 listeners"
  - every **approved credit name** of anyone who planted a seed that Ring (whether or not it grew; planting counts as growing the Ring)
  - "and 141 listeners who stayed anonymous"
  - counts: seeds planted, seeds grown, crossroads decided, sounds added
- Revision credits separately name the seeds that grew into that specific fragment.
- The Ledger is the "totality" view of ownership: the whole story credited to the whole community.
- Phase 2: a printed Ledger panel at the Grove trailhead each Listening Day.

### 3.5 Canon
- The Story view of the Journal includes **canon blocks** where listener decisions changed the story. The Grow screen shows "What listeners have decided" per Grove.
- Canon can also come from answered Questions ("Listeners revealed who left the lantern").

### 3.6 Sound seeds: your sound becomes the place
- A sound seed recorded at the marsh can be promoted by the sound designer into an `audio_assets` row (`source='community_sound'`) with an `asset_rights` row (`community_sound_grant`, linked to the seed), then added to an ambience layer.
- The contributor sees: "Your sound is part of the Salt Marsh surroundings now." Their credit name appears under Settings → Credits → Surroundings.
- This makes the soundscape a community field recording of the place: real sounds, gathered by the people who love it.
- Guidance shown at recording time: "Hold still, point the phone at the sound, no voices please." There's a 30 s cap; voices are rejected in moderation.

### 3.7 Echo Leaves: listener voices inside the story
- Writers can create a special Leaf ("Echoes of the marsh") that weaves short quotes from seeds marked `may_quote`, read by the narrator, or, for 18+ seeds marked `may_use_voice`, the listener's own voice.
- These Leaves are tagged in credits as "Voices from listeners," with the credit names.

### 3.8 Story Circles: the in-person writers' room
- At each Listening Day and once mid-Ring, there's a facilitated in-person gathering at the Grove. This is the business plan's InSight pathway feeding InDigeny.
- People listen together, read resting and sprouting seeds aloud (anonymized), and workshop directions with the story team.
- The Grow screen lists upcoming `gatherings` for Groves you've visited (registration is on the website).
- **The top rung:** regular participants can be invited to join the story team as **volunteer writers** (staff role `writer`, under a volunteer agreement), turning listeners into authors.

---

## 4. The participation ladder (many doors)
| Effort | Door | Who it suits |
|---|---|---|
| 5 seconds | Vote at a Crossroads | Everyone, including kids |
| 15 seconds | Record a sound seed | Families, kids with a parent, people who don't like writing |
| 30 seconds | Hold-to-plant a "noticed" voice seed | Walkers who want to stay eyes-up |
| 2 minutes | Answer a Question; plant a `next` or `character` seed | Story-curious listeners |
| 10 minutes | Share a real memory (oral-history route) | Long-time residents, elders, families with history here |
| 2 hours | Attend a Story Circle | Committed community members |
| Ongoing | Volunteer writer | The most invested |

---

## 5. The Grow screen (sub-screen 2)

Opened from the bottom bar (button label **Grow**, sprout icon). It's organized by Grove. A Grove picker at the top defaults to the most recently visited one.

```
┌──────────────────────────────────┐
│ Grow                Salt Marsh ▾ │
│ ┌──────────────────────────────┐ │
│ │ RING 2 · THE LONG THAW       │ │
│ │ Planting · 23 days left      │ │
│ │ 312 seeds planted · 6 grown  │ │
│ │ ▶ A note from the story team │ │  ← writer_note audio/text
│ └──────────────────────────────┘ │
│ Crossroads                        │
│ ⑂ Should Mara cross the dike?    │
│   You chose: Wait · closes Dec 9 │
│ Questions the Grove is asking     │
│ ? Who left the lantern on the     │
│   dike?              [Answer]     │
│ Your seeds                        │
│ 🌱 "The flies rise like…"  Read   │
│ 🌿 "A girl named Ivy…" Sprouting  │
│ 🌳 Heron sound          Grown →   │
│ [ + Plant a seed ]                │
│ What listeners have decided    >  │
│ The Ledger                     >  │
│ Story Circles: Sat Dec 13      >  │
│ ─────────────────────────────    │
│ How was this visit? (optional)    │  ← check-in, only when eligible
└──────────────────────────────────┘
```
- **Plant a seed** from here works only within 7 days of a visit to that Grove, and as text only. On-site voice planting happens from the map (§2.2).
- **The age gate** is shown once, before the first seed or vote. It asks for an age bracket (under 13, 13–17, 18+, or "an adult planting for my family") and stores it in `devices.age_gate`. Under-13 listeners see voting, the Ledger, Canon and Story Circles, but not seed planting (§6).
- **Empty state** (no visits yet): "Visit a Grove to help it grow." with a short explainer of seeds, crossroads and rings.

---

## 6. Safety, rights and fairness
- **Children:**
  - Under 13: no free text, voice or contact collection. Voting and viewing only.
  - 13–17: text and voice seeds are allowed, but a voice is never published (`may_use_voice` requires 18+), and no `memory_contact`.
  - Children's-privacy approach to be confirmed with counsel.
- **Personal information:** the server strips emails and phone numbers. Voice seeds are heard only by staff. Voice files are deleted on the retention schedule (DATA_MODEL §10). `memory_contact` is encrypted and purged after 90 days.
- **Moderation:** every seed enters the inbox.
  - Flags: `pii_stripped`, `sensitive_culture`, `real_person`, `private_story`, `safety`.
  - Credit names are moderated before they appear in the Ledger.
  - Hidden seeds show the contributor "This seed couldn't be used," with a link to the guidelines.
- **Cultural integrity:** seeds touching Indigenous knowledge, sacred sites or specific communities' stories are flagged `sensitive_culture`. They aren't woven without the community permission process in the content guidelines.
- **Fairness:**
  - No public seed text, no likes, no leaderboards, no "top contributors".
  - Writers' guidelines encourage weaving several seeds per revision and drawing from many voices.
  - A public "How seeds grow" page explains the selection criteria (fit with the story, care for the place and people, variety of voices, practicality to record).
- **Abuse resistance:** rate limits (10 seeds and 2 sound seeds per device per day); attestation for votes; seeds and votes require a recent session in that Grove (server checks a `session_started` event for the device and grove within 7 days).
- **Rights:** seed terms are versioned (`seed_terms`). Any later use beyond the granted scope requires contacting the contributor, which is only possible through the memory route; otherwise, don't.

---

## 7. Staff tools (admin)
| Tool | What it does |
|---|---|
| **Seed inbox** | Filter by Grove, Ring, kind, anchor fragment, status and flags. Play voice inline with a transcript field. Keyboard triage: R read, S rest, H hide, T tag. Bulk theme tagging. |
| **Ring board** | Kanban: Planted → Read → Sprouting (linked) → Grown. Drag seeds onto draft revisions, crossroads options, questions or sound assets to create `seed_links`. |
| **Theme map** | Counts per theme and anchor fragment, so writers see where listeners' imaginations cluster (manual tags only; no AI clustering). |
| **Crossroads builder** | Anchor picker, prompt, options, teaser upload, schedule; a results view after close; confirm the outcome; list dependent revisions and cues that will unlock. |
| **Ledger review** | Approve or reject credit names; preview the Ring Ledger. |
| **Listening Day release** | Choose revisions for the Ring, set `publish_at`, preview the pack diff, confirm. |

---

## 8. Endpoints (edge functions; zod-validated; device-scoped)
| Function | Purpose |
|---|---|
| `POST /plant-seed` | Create a seed (text) or reserve one with voice (returns a signed upload URL for `seeds-voice/{id}.m4a`). Checks the age gate, terms version, recent grove session and rate limits. Strips PII. |
| `POST /seed-addendum` | Add text to the device's own seed within 7 days |
| `GET /my-seeds` | `[{client_seed_id, status, links:[{type, fragmentId?, revisionId?, ringId, label}]}]` for this device only. Never returns other devices' data. |
| `POST /vote` | `{device_id, crossroads_id, option_id, attestation_token, fragment_heard_at}`. Verifies attestation, open status and a recent grove session. Upserts the vote. |
| `GET /my-votes` | Statuses of this device's votes, plus outcomes once decided |
| `POST /attest` | Verify App Attest / Play Integrity once; set `devices.attested_at` |

The client checks place-gating with its own location (within `vote_radius_m`, having heard the anchor). The server checks a recent session in the Grove. Coordinates are never sent.

---

## 9. Metrics (board dashboard)
- Seeds planted per Ring; unique planting devices; share planted on site; kind mix
- Lineage: % read within 14 days; % grown; median days planted → grown
- Crossroads: votes per crossroads; share of anchor listeners who voted
- **Ownership-return effect:** the return rate of devices that planted a seed vs those that didn't (cohorted, with n). This tests whether participation drives return, a key hypothesis in the business plan.
- Story Circle attendance (entered by staff)

---

## 10. Phasing
| Release | Includes |
|---|---|
| **v1** | Seeds (all kinds; voice and text), lineage and statuses, "Your seed grew" moment, Questions, Crossroads with attestation, Rings, Ledger, Canon, sound seeds into ambience, Grow screen, all staff tools |
| **v1.x** | Echo Leaves using listener voices, the printed Ledger at trailheads, a Story Circle check-in code (scan at a gathering for a "was there" note in your Journal) |
| **v2** | A public web Grove page (story history, canon, Ledger); cross-grove characters; a volunteer-writer workspace in the admin |
