# B·S3 review (Claude): code only, before the device protocol

**Verdict: one fix before Jordan runs T4–T7.** Everything else matches the plan review:
- the Media3 `SimpleBasePlayer` mirroring the mix
- the focus listener's full mapping
- the JS focus state machine, with its transitions unit-tested
- the module as the only route owner
- the library's session layer switched off
- the engine rules

## Required: a real media notification (otherwise T7, and the lock-screen part of T4, will fail)
`MixPlaybackService.promoteForeground` builds a plain `NotificationCompat` with no `MediaStyle` and no actions, then calls `startForeground` with it. That overrides Media3's own media notification. Android shows lock-screen and shade media controls only for a media-style notification tied to the session token, so this one won't show play or pause.
- **Remove the hand-built notification.** Let `MediaSessionService` publish its default media notification (`DefaultMediaNotificationProvider`), which updates from `MixPlayer`'s state: play/pause and seek-back, with the title, artist and app icon. Media3 also handles promoting the service to the foreground, and demoting it on pause, while keeping the notification.
- **Avoid the 5-second foreground-service crash.** After `startForegroundService`, Android requires `startForeground` within about 5 seconds. Make sure `MixPlayer` is already `playWhenReady = true` (the user just pressed Start) when the session is added, so Media3 promotes it at once. Log any `ForegroundServiceStartNotAllowedException` or `ForegroundServiceDidNotStartInTimeException`.
- **Keep the existing `IMPORTANCE_LOW` channel** for the media notification, so it's silent.

## Notes (no change needed)
- `setWillPauseWhenDucked(false)` means Android 12+ ducks InTell itself on short notification sounds, so a `duck` event may never arrive. That's acceptable: T6's "duck, not pause" passes either way. Say which happened in the report.
- A `userPause` in `suspendedTransient` becomes `userPaused`, and the later `gain` is a no-op. That's correct per the review.

## Next
Make the fix, keep lint, typecheck, test and both CI jobs green, do one release rebuild, then run the device protocol with Jordan (T4, T5, T6, T7 and the 15-minute T1). Fill in run 3 and the report, push, and stop for Claude's review.
