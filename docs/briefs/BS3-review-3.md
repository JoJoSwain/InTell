# B·S3 review 3 (Claude): the T6b silent resume

**Verdict: option 2, done the way Media3 expects. Not option 1.** It's a good investigation: AudioHardening **reason 6** with `level: partial` means InTell had **no foreground service** when the shade's Play ran, so Android 17 silenced the playback without any error.

**Why it happened, and part of it is my fault.** Android's own guidance (developer.android.com, "Android 17 background audio hardening") says:
- Apps using Media3's `MediaSessionService` are "not likely to be impacted".
- A play press on the system media controls, or a media key, grants **while-in-use**, so a foreground service started in response to it qualifies.
- After a permanent stop, a resume should result in a **newly started** foreground service.

Media3 starts that service at the moment the controller's play command sets `playWhenReady = true`. Review 2 told you to make `handleSetPlayWhenReady(true)` intent-only. That stopped Media3 from starting the service inside the window Android allows, so by the time JS called `resume()`, InTell had no service. That instruction was wrong under Android 17.

## The fix
1. **`MixPlayer.handleSetPlayWhenReady(true)`:** set `playWhenReady = true` and `invalidateState()` **immediately**, inside the command, so Media3 starts or promotes the foreground service in the while-in-use window. Then forward the play to JS.
2. **JS:** request focus (keep the bounded retry), then `ctx.resume()` with the 1 s fade-in.
   - If focus is still denied, call `setPlayback(false)` within the retry window. The shade goes back to paused, and "audio busy" shows.
   - A brief "playing" state that turns into "paused" on a denial is acceptable. Being honest within about 1.5 s is enough.
3. **Keep the service through transient losses.** Don't demote it during `suspendedTransient` (a call or `LOSS_TRANSIENT`); Android says to keep it through transient interruptions under 10 minutes. Let Media3 demote it on a user pause, a hard `LOSS` or `noisy`, while the **session and its notification stay**, so the lock-screen Play keeps working.
4. **Don't** keep the service up through a user pause or a hard loss (option 1). Android treats those as permanent stops, and a service kept running would itself be the misbehaviour.
5. **Diagnostics:** log `contextState` after a background `resume()`, using a native `Log.i` from the module or a non-stripped path, so the next run doesn't depend on `console.log`.
6. **Tests:**
   - Unit: remote play sets `playWhenReady` at once; a denied focus request reverts to paused within the retry window; `suspendedTransient` doesn't demote.
   - Device: for local diagnosis, use `adb shell cmd audio set-enable-hardening throw` so a violation crashes loudly instead of failing silently. Run the real protocol with the default setting.

## Device re-check with Jordan (about 10 minutes, release build)
- **T6b:** Start → a YouTube video (hard `LOSS`) → close it → **Play on the lock-screen card while locked** → sound in the earbuds within about 3 s. Then the same from the unlocked shade.
  - Jordan confirms **by ear**. State readings alone don't count as a pass.
- **T5 quick re-check:** a call, then hang up, and it resumes automatically. This confirms the service survives the transient loss.

## Next
Implement, keep lint, typecheck, test and both CI jobs green, rebuild release, run T6b and T5 with Jordan, update the report (and push `ce968f4` with it), then stop for Claude's check.
