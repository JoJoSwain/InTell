# M6 reset, Step 4b (Claude): publish the update properly, and read evidence from logcat

Good stop again. Two infrastructure problems, both solvable without guessing.

## 1. Why the night version never reached the phone (by design)
`persistPackIfChanged` builds a **new pack version** when the content changes. But a build tagged with a release starts **non-live**, and goes live only when that release goes live (`fn_release_go_live`). `get_pack_index` serves only the latest **live** build. A local "republish" without a **new release** therefore leaves the index at version 1, and the phone correctly sees nothing new (sync compares versions).

**Fix: use the real path.**
- Publish the night-version change through a **new local release**, the way staff would.
- No hand edits to `live` / `pack_builds` / versions.
- Check that `get_pack_index` now lists grove `…0102` at **version ≥ 2** and that the night asset is public.
- On the phone, run a **normal Sync** (no force). It should pick up version 2, and the asset count should rise to 22.

This also tests the product's "phones receive updated stories" path, end to end. If the release won't go live, STOP and report what `fn_release_go_live` / `run-jobs` returned. That would be Lane A's area, so don't patch functions.

## 2. Stop reading the screen; read logcat
`uiautomator dump` fails ("could not get idle state") because InTell's screens never sit still: the 1-second marker pulse, the live meter. Don't fight it.
- **Runtime:** while the session is `exploring` or a narration is live, write one **`diag`** line to `InTellAudio` every 5 s, plus one right after every effect: `diag ctx=… master=… started=… narr=<id8>|none paused=… pos=… out=… phase=… playing=…`. No coordinates or marker codes.
- **`check-play.mjs`:**
  - `adb logcat -c`
  - the reset link
  - the scan
  - wait 10 s
  - `adb logcat -d -s InTellAudio`
  - **Pass when:** `play <frag8> day|night`, a `cmd playNarration` line, and a `diag` line with `narr=` not none, `paused=false`, `pos>0` and `out` between −35 and −10.
  - **Fail clearly** on `showTeaser <reason>`.
  - No `uiautomator` in the pass/fail path.
- The Data screen stays for humans.

## Order
1. Commit this doc.
2. **No phone needed:** write the `diag` lines (with tests), rewrite `check-play` to use logcat, and publish the night version through a new local release. Rebuild (reuse `android/`).
3. **Then ask Jordan** "Is the phone free?":
   - install
   - normal Sync (expect pack `…0102` v2, assets 22)
   - Step 4 twice
4. If both pass and Jordan is available, do Step 5 (A1–A9). Otherwise STOP and report.

Two strikes resets for Step 4 after these changes.
