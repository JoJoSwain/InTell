# Lane B · M6 report (reset Steps 4–5)

Branch `b/m6-narration-session` @ overlay-clear tip (includes `9208789` and readable breadcrumbs `c9e8eb3`). Pixel `67090DLKY005KL`, walk packs via local Supabase, scans `intell://f/WTQR0001` (frag tail8 `00000214` day) unless noted.

## Step 4 (check-play)

| Item | Result |
|---|---|
| Evidence | `local/m6-walk-test/step5-step4-checkplay.txt` |
| Result | **PASS** — `play 00000214 day`, `cmd playNarration`, live `pos>0` with `out=-25` in band (−35…−10). Meter sometimes flickers to `out=-100` while `pos` still advances. |

Lane A had already run early phone steps of the reset prompt once; this folder’s Step 4 was re-run so evidence lives here.

## A2 overlay bug (found during ear suite)

After a **natural** narration end, shared does not emit `stopNarration` (only on session end). The PlayingOverlay stayed up with **Pause** while `session.playing` was null, so `togglePause()` no-oped. Mid-play Pause/Resume already worked.

**Fix (mobile only, Claude-approved):** `ExploringRuntime` clears the overlay on every `narrationEnded`; `togglePause` with overlay and nothing playing clears it and breadcrumbs `togglePause:noop no-playing`; optimistic Pause UI + `togglePause:pause|resume` crumbs. Commit `9208789`. No shared / Lane A change (director already sees engine voice-ended).

## Step 5 ear suite

Evidence: `local/m6-walk-test/step5-<check>.txt` (UTF-8). Completions block QR replay — rearmed with `pm clear` + install both walk groves when needed.

| Check | Result |
|---|---|
| **A1** | **PASS** — live `out=-16`; ear: walk-2 leaf test line heard clearly. |
| **A2** | **PASS** — overlay Pause → Resume; crumbs `togglePause:pause` / `togglePause:resume`; live again (`out≈-15`). Resume may start ~1 s earlier (breath). |
| **A3** | **PASS** — Back 10 s: `pos` 20520 → 10720 (Δ≈9.8 s), still playing. |
| **A4** | **PASS** — lock screen: `remote:pause` then `remote:play`. |
| **A5** | **PASS** — Bluetooth disable mid-story → `paused=true` / `ctx=suspended`; enable + Resume → live `out=-17`. |
| **A6** | **PASS** — notification **Stop exploring** → `remote:stopExploring` / `sessionEnded`; adb scan again → `play 00000214` + `cmd playNarration`. |
| **A7** | **PASS** — swipe away / force-stop mid-story → relaunch with **no** stale Pause/Resume overlay → scan → live. |
| **A8** | **PASS** — lock ~2 min while exploring: `LocationTaskService` `isForeground=true`, `types=0x00000008` (location), channel `intell-exploring-location`. |
| **A9** | **PASS** — camera/deep-link path produced `scan hash` + `play 00000214` + `cmd playNarration` (QR asset `local/m6-walk-test/qr/walk-test-qr.png`). |
| **A10** (observe) | Alarm/timer mid-story: paused (`ctx=suspended` `paused=true`); after dismiss diagnostics showed `narr=none` / `started=false` once — recorded, not fixed. |
| **A11** (observe) | Overlay Pause first, then timer: **stayed paused** (`paused=true`, no auto `remote:play` / `togglePause:resume`). |

## Walk prep

`pm clear` → install both walk groves → **Packs 3, assets 22** → `adb logcat -G 16M` → `adb logcat -c` → Stay awake off (`stay_on_while_plugged_in=0`). Permissions re-check is on-device.

## Commands

- `pnpm lint && pnpm typecheck && pnpm test` — green (overlay-clear commit)
- Release APK already carried the overlay fix before final ear pass; no rebuild for Prompt 2c
- `git push` — `9208789` and this report

## Open

- A10 post-alarm `narr=none` / `started=false` (observe-only).
- `out=-100` meter flicker while audio is audible (does not block Step 4 / A1 when a live sample hits the band).
