# ADR 0004: Product realignment before Milestone 3

## Status
**Accepted**, 2026-11-20. Decided by the product owner (Jordan "JoJo" Swain) with the architect (Claude) in the M3 design review. This ADR amends PRODUCT_SPEC, DATA_MODEL, AUDIO_SPEC, TECH_SPEC, JOURNAL_SPEC, PARTICIPATION_SPEC, DESIGN, BUILD_PLAN, AGENTS.md and ADR 0003. Where any of those docs still disagree with this ADR, **this ADR wins** until the doc is rewritten. **Amended by [ADR 0005](./0005-listener-experience.md)** (2026-11-20 evening), which resolves the open questions below and corrects the naming in Purpose.

## Context
M2 shipped the database, playability, packs and the publish pipeline from the v2 specs. Before building the admin (M3), the product owner reviewed every M3 component against Replaceplace's purpose and how the team will actually work: 5–10 Replaceplace staff who write, record and publish all content themselves. Many v2 assumptions (outside contributors and consents, landowner approvals, story seasons, public votes, offline maps, protected coordinates) no longer hold.

## Purpose (governs every design choice)
**Indigeny** is the phenomenon Replaceplace explores: the embodied struggle between **Earth** (the physical environment) and **World** (cultural practice, history, social norms), lived through the **body**. **InTell** (the definitive app name) exists to bring that phenomenon forward, so people explore themselves and their relationship with Place through stories encountered in real places. **InTell** is both the app and Replaceplace's story pathway; **Indigeny** is the phenomenon all of Replaceplace's pathways explore, not a pathway (corrected by ADR 0005).

**The core experience** is a person physically present in a real place, encountering root, branch and leaf fragments at GPS points, inside sound effects and a soundtrack shaped by geofenced zones. The **Chronicle** and the **Journal** are supporting features. They must never compete with, or substitute for, being on site.

## Decisions

### Places
1. **Geographically flexible.** Nothing in the app or admin is specific to one site or region. Groves can be authored anywhere with GPS. The Farmington Bird Refuge (the George S. and Dolores Doré Eccles Wildlife Education Center) is the first grove, not a special case.
2. **Sites merge into groves.** "Site" is informal staff shorthand only and never appears in the app or marketing. The `sites` table goes; its fields (access notes, website and gatherings links, the wildlife-speaker setting) move onto `groves`. (ADR 0005 later removes access notes entirely: arrival logistics are left to the listener.) Groves belong directly to a region. Regions stay: timezone, sun reference point, and the shared surroundings and music pack.
3. **No landowner approvals.** `site_approvals`, the site check in playability, the `SITE_APPROVAL` checklist code and approval expiry are removed. Replaceplace doesn't request landowner approval to place stories.
4. **One story world.** All groves are parts of one story. Characters and threads are story-wide and can appear in any grove (as major or minor characters). **Prerequisites can cross groves** (plot bridges between places).

### People, content and rights
5. **All content is produced by Replaceplace**: writing, narration, music and sound effects. No outside contributors, so **no contributors, consents, credits or audio rights** (`contributors`, `consents`, `revision_contributors`, `asset_rights`, the license and source enums, and the `CONSENT_APP` and `NARRATION_RIGHTS` checklist codes are removed). Removal from phones happens only by unpublishing.
6. **Staff accounts:** 5–10 staff. Roles stay global (no per-grove or per-region scoping for now). **Email and password only, no two-factor for anyone.** Accounts are created by an admin invite only (no self-signup). Writers can be given accounts to upload drafts. Supabase's password protections are on (minimum length, leaked-password rejection, session expiry).
7. **No internal review workflow.** Revisions go from draft to published. `in_review` and `approved` stay in the enum but are hidden in the admin.
8. **Staff make phone-ready audio files** to AUDIO_SPEC §6 before upload. The admin checks format, channels, bitrate and loudness and warns when they're off spec. There's no server-side transcoding. Masters live in Replaceplace's own archive, outside InTell.

### Fragments, markers and the logic chain
9. **Visibility is `standard` or `physical`.** `unmarked` is removed. `protected` is renamed **physical**: a fragment unlocked by scanning a QR code on a physical object at the spot. Physical markers **appear on the map** like other fragments. Their coordinates are no longer secret. They **follow the logic chain**: scanning plays the fragment only if its prerequisites are complete; otherwise the scan shows the locked teaser. A **scan alone is sufficient** (no GPS check). QR codes are web links on Replaceplace's domain (`https://{LINK_DOMAIN}/f/{code}`, `LINK_DOMAIN` on `replaceplace.com`), matched by sha256 hash. Staff print and place them by hand.
10. **Map markers:** a fragment the listener can play now shows at **100% opacity**; a fragment that's locked (prerequisites incomplete) **or** outside its time window shows at **35% opacity**. Root, branch and leaf each have a categorical color (design tokens; Ashley's call). Locked fragments are deliberately visible, so people can see where the story leads. Retired fragments are hidden.
11. **Teasers.** Every fragment has one authored, fixed **teaser** (replaces `gap_hint`), required to publish. Tapping a locked or out-of-window marker shows a **text-only pop-up** with the teaser: no title, transcript or audio, and no system-written text. A teaser pairs a **place cue** (a sound, texture or thing in the place, or the physical object to scan) with a **story cue** (a character, event or mood) and never gives away an unheard title or event. If a fragment exists only by day or only by night, its teaser hints at that.
12. **Trigger radius** is 15–35 ft (stored in metres), **35 ft by default** for every tier. Two 35 ft fragments need 70 ft between centers to avoid overlap; overlaps are a **warning only**. Physical markers don't use a radius. **Units shown to staff and listeners are feet and miles**; storage stays metric.
13. **Story Contingency vs Story Correction.** Every revision is tagged one or the other (no default). A **Contingency** changes the story: completion of earlier revisions no longer satisfies prerequisites, so the listener must complete the new revision (on site) before fragments that aren't yet revealed can unlock. Fragments **already revealed stay revealed**. A **Correction** (a fixed typo, a cleaner recording) carries completion forward: no reset and no replay. The first revision of a fragment counts as its first contingency.
14. **Day and Night.** Every story fragment, sound-effect layer and music cue is tagged **Day** or **Night**. These are the only two time windows; dawn and dusk are removed. Day and night are determined from **sunrise and sunset for the region** (its timezone and sun reference point); publishers choose only Day or Night. A fragment has a Day version, a Night version or both (at least one). Completing **either** version satisfies prerequisites. A fragment with only one version shows at 35% outside its window. The version is chosen when playback starts and plays to the end. The tag lives where a file is used (fragment version, ambience layer, music cue), so one uploaded file can be placed under both tags without a second upload.

### Supporting features
15. **Chronicle** (replaces the v2 Journal's look-back role). Characters are the primary navigation (card contents amended by ADR 0005: a required portrait, the back story and one writer-chosen home grove instead of every grove they appear in): each character card has a portrait, a summary that grows as the listener completes fragments (one authored card line per fragment–character link), the groves they appear in, and their related fragments. The Chronicle also lists fragments the listener has completed and related locked fragments (with the same teaser). **A fragment becomes replayable in the Chronicle only after the listener has completed it in situ**: inside its radius, by scanning its physical marker, or by the accessible trigger **within 35 ft of its GPS point** (see decision 28). After that, it can be replayed anywhere, anytime (narration only off site). Replay is **per time version**: hearing the Day version on site unlocks Day replay only; completing the Night version on site adds Night replay.
16. **After a Story Contingency, the old version leaves the Chronicle** (option A). Listeners replay only the current revision's versions that they've completed since its latest contingency. Corrections replace the old file without affecting replay.
17. **Journal** (replaces Grow and seeds). Listeners write or record thoughts (plot, characters, what they noticed). Replaceplace's writers read them and author new content informed by them. Nothing a listener submits is ever played, shown to other users or credited. In docs this is **Journal-informed authoring**; it is human authorship. The no-AI-generation rule is unchanged.
18. **Participation features removed:** Rings (all of them: ring tables and links, planting windows, Listening Day, Journal growth bands), Crossroads (votes, attestation, outcome-gated revisions), the Ledger and all public credit names, Echo Leaves, sound seeds, and memory seeds becoming storyteller fragments. Kept for M9: Journal entries (text or voice, private to staff), questions, the lineage of an entry ("your idea grew"), and the optional check-in.
19. **Home screen:** the map, with **Chronicle** (bottom left), **Journal** (bottom right) and the **Embark** button in the center (ADR 0005: routes to the nearest grove's opening root on foot, by bike or by transit). **Settings** is at the top right.
20. **Story Notes** is the staff-only planning area: story-wide threads, private character notes, and each fragment's **Indigeny note** (Earth / World / Body: the physical feature, the cultural or fictional element meeting it, and what the listener is invited to do or notice). Never in packs.

### Publishing and operations
21. **Releases.** Publishing normally happens in **batches called releases**. A release can span groves (e.g. a plot bridge). It's checked and published as a unit: if any check fails, nothing goes live. A release can be published now or **scheduled** for a date and time; scheduled releases are re-checked at go-live, and a failure leaves it unpublished with the reason shown in the admin. All affected packs go live together.
22. **Edits to live content are staged.** Changes to a published grove's or fragment's fields (location, radius, prerequisites, teaser, visibility, character links, card lines and so on) don't reach phones until they're included in a published release.
23. **Staff preview mode.** Staff can sign in on the phone app and walk draft content on site before it's published. Draft content is visible only to that signed-in staff device and is never cached publicly.
24. **Hosted from M3.** Staff work on their own computers in a shared, hosted environment: a hosted Supabase project and a deployed admin web app. The product owner creates the hosted accounts; keys never enter the repo.
25. **Audit log:** visible to editors and admins.
26. **English only** for content for now. The language structure stays, so adding a language later needs no migration.

### Maps (ADR 0002)
27. **Google Maps, online.** All groves have phone signal, so the base map is online-only on phones and in the admin. **Grove audio is still downloaded before a walk** (smooth locked-screen playback, battery, no buffering). Offline map tiles are dropped. See ADR 0002.

### Playback
28. **Hands-free, one story at a time** (decided 2026-11-20). Narration starts **automatically** when the listener arrives: no Play button for a first listen (a successful physical-marker scan also plays automatically). **Only one story fragment plays at a time**, layered with the surroundings and soundtrack; a second trigger waits in a queue of one and never overlaps or interrupts. The 70 ft spacing guideline keeps this rare. **Accessible play becomes an automatic, more forgiving trigger:** with the setting on, an unlocked standard fragment starts on a single location fix within 35 ft of its GPS point. It needs location, with no fallback when location is off. Pause and lock-screen controls remain during playback; Chronicle replay remains a deliberate choice.

## Open questions (product owner)
Resolved by [ADR 0005](./0005-listener-experience.md) on 2026-11-20:
- ~~Which groves a character card lists~~ → one writer-chosen **home grove** (ADR 0005 §2).
- ~~How a completed fragment with a newer Story Contingency looks~~ → it **pulses** until heard; tapping shows a writer-composed **change teaser** (§3).
- ~~Whether the Chronicle hints at the other time version~~ → yes, a writer-composed **other-time hint** (§4).
- ~~Where listener progress lives~~ → on the phone, carried by the phone's own **iCloud/Google backup**; no accounts (§1).
- ~~The center home-screen button~~ → **Embark** (§5); no cars anywhere in the experience (§6).
- ~~A printable grove guide~~ → **no**; everything is on the phone (§7).

Still open:
- Journal entries from children under 13: the age gate stays, and the children's-privacy approach needs counsel review before M9.

## Consequences
- **M3 starts with a schema realignment PR** that brings the merged M2 schema, functions, packs, tests and seed in line with this ADR (new migrations only; merged migrations aren't edited). See `docs/briefs/M3-admin.md`.
- PRODUCT_SPEC and DATA_MODEL are rewritten to v3. AUDIO_SPEC, TECH_SPEC, BUILD_PLAN, AGENTS.md and ADRs 0002 and 0003 are amended. JOURNAL_SPEC, PARTICIPATION_SPEC and DESIGN carry a superseded banner until they're rewritten before M8, M9 and M5 respectively.
- M10 (Crossroads) is removed from the build plan.
