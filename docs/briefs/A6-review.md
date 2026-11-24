# A6 review (Claude)

**Verdict: the code is right; the tests are short of the brief.** Add the tests below (and fix anything they find), then it's ready to merge.

The design matches the plan and its review:
- a pure reducer with versioned state, and a target mix diffed into commands
- the suspended-command policy
- epoch-ms Hush, added alongside the old API
- B·S2's files untouched
- the Simulator now runs through `directorStep`

CI is green.

## Required: director-level tests the brief lists but the PR lacks
`director.test.ts` currently covers ducking with the afterglow, the motif, a non-resuming interruption, `assetFailed`, resume, determinism and the beacon choice. Add:
1. **Afterglow resolve by tier.** After a Root, Branch and Leaf completion, the right tier's resolve plays on `moment`, and the fragment override wins. With no asset, there's a plain 8 s pause.
2. **Growth deferral.** A completion that unlocks a higher growth cue switches only after the afterglow ends.
3. **Hush.** It's scheduled after the quiet interval, and the "Listen." cue plays on `ui`. A `play` during Hush cancels it with a 1 s fade.
4. **Accent gating.** While narration plays, accents are scheduled only inside breath-point pauses, never otherwise. There are at most 2 pending, no more than 20 s ahead.
5. **The locked teaser.** It plays once per fragment per day, never over narration, and never for `wrongTime`.
6. **The beacon lifecycle.** `startBeacon`, then `updateBeacon` (pan and gain change as the listener moves), then `stopBeacon` when narration starts, when the beacons setting is off, or on the speaker route.
7. **Budget under a crossfade.** During a cue crossfade, accents and the beacon pause, and the total never exceeds 12.
8. **The mix ladder.** Starving windows shed layers in the agreed order; healthy time restores them one step per `MIX_RECOVER_STEP_MS`; narration is never shed.
9. **Interruption resume from a breath point.** `began`, then `ended` with `shouldResume: true`, gives `resume` and then `playNarration { startAtMs: resumePointMs(...) }`.
10. **Memory policy.** Narration loads at 24 kHz; at most the current plus the next likely fragment are loaded; others unload; and no `load` happens while suspended.
11. **Resume mid-Hush.** Serialize, then parse, and the commands continue identically. Mid-afterglow is already covered.

**Walk test:** strengthen "resolve ≥ 1" to "one resolve after **each** natural completion".

## Next
Add the tests, fix anything they find, and keep `pnpm lint`, `typecheck` and `test` passing with both CI jobs green. Add a "Review fixes" section to `A6-report.md`, push, and stop for Claude's check.
