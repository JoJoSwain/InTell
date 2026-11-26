# M6 reset, Step 4 follow-up (Claude): the app was right; the test story wasn't

Good stop, and good evidence. Here's what it shows.

## Run 2: correct behaviour, a flawed test (my mistake)
- **The scan worked.** `scan hash=0ae7c708` is exactly `sha256("WTQR0001")`. The session entered `exploring`.
- **The QR fragment has only a Day version** (`w2-qr-day`). The runs were at about 19:09 MT, and sunset was about 17:02. So A4 correctly answered with `showTeaser{reason:"wrongTime"}`, with no `play` and no `playNarration`. **That's the M6 rule "Day-only is silent at night" working.**
- `cmd load 9cf7020d` is `w1-branch-b-day`: a director preload. The director thinks it's day because the runtime never sends it the window. See the follow-up below. It's harmless here.

## Run 1: a real bug, the packs weren't reloaded after install
The runtime built its packed world at app start, before `load-walk-packs` installed the groves. The scan therefore had no marker to match until a force-stop. **Fix:** after any install, sync or reset from the Data screen, including the dev deep links, call `runtime.reloadPacks()`. Add a test.

## Fixes before retrying Step 4
1. **Reload packs** after install, sync or reset (above).
2. **Breadcrumb every session effect** that matters to playback: `play <frag8> <window>`, `showTeaser <reason> <frag8>`, `queued <frag8>`, `stopNarration`, `narrationEnded <reason>`. This would have shown "wrongTime" immediately.
3. **Give the QR story a Night version, so the at-home checks work at any hour.**
   - Generate `w2-qr-night` with the same local generator: "Walk test 2. QR leaf. Night version. This is clearly test audio only…", then the count.
   - Add it as the **night** version of the QR fragment's current revision.
   - Republish the local walk release.
   - Reload the packs on the phone with `load-walk-packs`.
   - Local content only (gitignored). Nothing else in the layout changes.
4. **Rebuild** the release app with the script. Reuse `android/` (no `--clean`), because there's no native change. Install it, then run `load-walk-packs`.
5. **`check-play` must also confirm** the breadcrumb `play <frag8> night` (or `day`), and must fail with a clear message if it sees `showTeaser wrongTime` instead.

The two-strikes counter resets for Step 4 after these fixes.

## Follow-up for after Step 5 (don't do it now)
Keep the director's world current: on each accepted fix and on `windowChanged`, give the director its `location` input. That's the time window, month, `insideGrove` and depth. Nothing goes to disk, and the coordinates stay in memory only. Then the threshold motif and the preloads pick the right Day/Night versions. Note it in the report as open.

## Then
Run Step 4 twice. If both pass, do Step 5 (A1–A9) with Jordan if he's still available. If he isn't, STOP and report.
