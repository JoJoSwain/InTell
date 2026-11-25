# B·S3 review 2 (Claude): run 3 results

**Verdict: one fix, then a 10-minute T6 re-check, then ready to merge.**

Run 3 confirms the architecture:
- **T4, T5 and T7 pass:** pause on unplug and play from the shade, automatic resume after a call, and a real media notification with working pause and play.
- **T6's duck path works.**
- **The 15-minute T1 shows no regression.**

## Required: play after a hard focus loss must actually come back
**What happened:**
1. Instagram took focus (`LOSS`).
2. Android's AudioHardening then **ignored** InTell's focus requests, so the spike showed "audio busy".
3. After Instagram was gone, pressing Play in the shade set the MediaSession to PLAYING, but the mix stayed silent. Only Start, in the foreground, recovered it.

**Likely cause:**
- After the pause, Media3 demotes the foreground service, so InTell counts as a background app, and AudioHardening ignores a background app's focus request.
- `MixPlayer.handleSetPlayWhenReady` also flips to "playing" **before** JS has focus, so the shade shows a state that isn't true.

**Fix:**
1. **Order the remote-play path:**
   - Let Media3 promote the service first: a media-session command is an allowed start of the foreground service.
   - Then request focus.
   - Then resume the context with the 1 s fade-in.
   - If needed, use a short bounded retry (for example 3 tries over about 1.5 s) while the promotion settles.
2. **Report honestly:**
   - `handleSetPlayWhenReady(true)` forwards the *intent* to JS and leaves the state unchanged until JS confirms with `setPlayback(true)`.
   - If focus is still denied, set the session back to paused, keep "audio busy" showing, and log the AudioHardening line.
3. **Fix the spike's state trap:**
   - A denied resume leaves the engine **paused**, not "running".
   - Start and Play stay enabled, so the next press tries again.
   - A later `gain` clears "audio busy".
4. **Add a unit test** for the controller path: remote play, then a denied focus request, then the state stays paused and the next play retries.

## Re-check with Jordan (about 10 minutes, same release-build setup)
1. Play the mix.
2. Start a video in another app (a hard `LOSS`), then close it.
3. Press **Play** in the shade with the phone **locked**, then again unlocked.

**Pass:** the audio returns within about 2 s, and the shade's state matches what you hear. Add the result to run 3 as "T6b".

## Not required
Mirroring the log to external storage on release builds (open question 3). Share and logcat are enough for spikes.

## Next
Fix, test (with lint, typecheck, test and both CI jobs green), rebuild, run T6b with Jordan, update the report, push, and stop for Claude's check.
