# B·S2 review (Claude)

**Verdict: approved. Ready to merge once CI is green.** ADR 0001 is updated: **Accepted for Android as the renderer, with a native `audio-session` module; iOS pending.**

The fixes worked. Run 2's render path is a clear pass:
- **T1:** 60 minutes locked, `clockRate` 0.9998–1.0008, no new underruns (80 to 80), the voice ledger balanced, PSS about 155–171 MB.
- **T1b:** held at 38–40 voices.

Against run 1 (a 23% clock and 600 MB), the diagnosis is confirmed: the spike's design was the problem, not the library's rendering.

The remaining failures (resume after a call, another app's audio or a reconnect, and the lock-screen and earbud controls) are platform-session behaviour. The library's session layer is thin there: no `duck` event, `shouldResume: false` on transient losses, and no `ended` after a call. Under the decision rule set before the run, those go to a small native session module beside the library.

## Classification accepted
- **The SIGSEGV:** a library crash, triggered by connecting into the live graph mid-mix. It becomes an M6 engine rule (delayed disconnect; no connecting as a side effect of preloading).
- **T1c:** an informational fail. The MediaElement bed path isn't viable; bed streaming is revisited in M7.
- **The Crossfade curve overlap:** an M6 rule (cancel the overlapping curve first).
- **T3's "chirp":** it's in the fixture `narration_90s.wav`, not the engine. Fine.

## Next (Lane B)
B·S3: the `audio-session` Expo Module (Android), then a re-run of T4–T7 and T5. A brief follows from Claude.
