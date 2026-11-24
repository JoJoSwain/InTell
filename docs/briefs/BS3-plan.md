# Lane B · B·S3 plan — `audio-session` module (Android)

**Branch:** `b/bs3-audio-session` · **Brief:** `docs/briefs/BS3-audio-session.md` · **ADR 0001:** Accepted for Android as renderer + native session module.

This plan is for Claude’s review. No module code until the plan is approved.

---

## 1. Goal

Own the Android **platform session** in a small Expo Module so the B·S2-proven `react-native-audio-api` graph can resume after interruptions, answer lock-screen / earbud controls, and duck correctly. Re-run T4–T7 and T5 (plus a short T1 check) on a release build.

**Out of scope:** AudioDirector (M6), iOS, bed streaming (M7).

---

## 2. Module API and events

**Package:** `apps/mobile/modules/audio-session` (local Expo Module, mirror `intell-storage`).

**JS surface** (`index.ts` + thin typed wrapper under `apps/mobile/src/audio/session/` — UI never imports the native module):

```ts
type SessionMeta = {
  title: string;
  artist: string;
  artworkUri?: string; // optional; spike can omit
};

type PlaybackState = "playing" | "paused" | "stopped";

type FocusKind = "loss" | "lossTransient" | "duck" | "gain";

type FocusChangeEvent = {
  kind: FocusKind;
  /** Present on loss / lossTransient only (brief table). */
  shouldResume?: boolean;
};

type RemoteCommand = "play" | "pause" | "skipBack";

type RemoteEvent = { command: RemoteCommand };

type RouteKind = "headphones" | "bluetooth" | "speaker" | "unknown";

type RouteEvent = {
  route: RouteKind;
  /** Coarse device hint from AudioManager / MediaRouter. */
  deviceType?: string;
};

type AudioSession = {
  start(meta: SessionMeta): Promise<void>;
  update(meta: Partial<SessionMeta>, state: PlaybackState): Promise<void>;
  stop(): Promise<void>;
  requestFocus(): Promise<boolean>;
  abandonFocus(): Promise<void>;
  addListener(
    event: "focusChange",
    cb: (e: FocusChangeEvent) => void,
  ): { remove(): void };
  addListener(event: "remote", cb: (e: RemoteEvent) => void): { remove(): void };
  addListener(event: "noisy", cb: () => void): { remove(): void };
  addListener(event: "route", cb: (e: RouteEvent) => void): { remove(): void };
};
```

**Focus mapping (native → JS):**

| Android | `kind` | `shouldResume` |
|---|---|---|
| `AUDIOFOCUS_LOSS` | `"loss"` | `false` |
| `AUDIOFOCUS_LOSS_TRANSIENT` | `"lossTransient"` | `true` |
| `AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK` | `"duck"` | omitted |
| `AUDIOFOCUS_GAIN` | `"gain"` | omitted |

`AudioFocusRequest`: usage `USAGE_MEDIA`, content type `CONTENT_TYPE_SPEECH`. Re-request focus on every resume (and on `start` / remote play).

**`start`:** create/activate MediaSession, show media-style notification, start FGS `mediaPlayback`, request focus, set state playing (or as passed later via `update`).  
**`stop`:** abandon focus, stop FGS, tear down session + notification.  
**`update`:** metadata and/or playback state must match the mix (playing ↔ paused).

---

## 3. Kotlin structure

Under `apps/mobile/modules/audio-session/android/…/audiosession/`:

| Piece | Role |
|---|---|
| `AudioSessionModule.kt` | Expo Module entry: JS methods, event emitters, wires the pieces below |
| `FocusController.kt` | Builds `AudioFocusRequest`, listener → `focusChange` events; `request` / `abandon` |
| `MixMediaSession.kt` | Media3 `MediaSession` (preferred) or `MediaSessionCompat` if Media3 adds friction in Expo; callbacks → `remote { play \| pause \| skipBack }` |
| `MixPlaybackService.kt` | `Service` / `MediaSessionService` with `foregroundServiceType="mediaPlayback"`; owns the notification while the session is active |
| `BecomingNoisyReceiver.kt` | `ACTION_AUDIO_BECOMING_NOISY` → emit `noisy` |
| `RouteObserver.kt` | Broadcasts / `AudioDeviceCallback` → emit `route` with headphones / bluetooth / speaker |

**Dependencies (Android):** AndroidX Media3 session + UI notification helpers (or androidx.media for Compat). Confirm versions against the Expo SDK used by `apps/mobile` before locking Gradle.

**Notification:** media style with **pause and play** (both visible as appropriate). Channel for media playback. Title/artist from `SessionMeta`.

**Earbud / BT media buttons:** handled by the MediaSession callback (not a separate receiver), so lock screen, notification, and headset share one path.

---

## 4. Manifest and config-plugin changes

**Expo config plugin** `apps/mobile/plugins/withAudioSession.ts` (registered from `app.config.ts`), applied at prebuild:

- Permissions: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS` (API 33+; request at runtime when starting a session if needed).
- Service: `MixPlaybackService` with `android:foregroundServiceType="mediaPlayback"` and exported=false (or Media3’s required export pattern).
- Receiver: `BecomingNoisyReceiver` for `AUDIO_BECOMING_NOISY` (or register dynamically from the service while active — prefer dynamic to limit always-on receivers).

**`package.json`:** `"audio-session": "file:./modules/audio-session"` like `intell-storage`. Autolinking via `expo-module.config.json` (`platforms: ["android"]` for this milestone; stub or omit apple).

**Dev client:** release and debug builds need a **new native binary** after the plugin lands (`expo run:android`). Plan one rebuild before device tests.

---

## 5. Turning off the library’s session layer

In `RNAudioApiEngine` init (once per process):

1. Call `AudioManager.disableSessionManagement()` **before** any focus/notification use.
2. **Remove** `AudioManager.observeAudioInterruptions(...)` and its interruption listeners.
3. **Remove** all `PlaybackNotificationManager` show/hide/event wiring.
4. Keep `getDevicesInfo` / route classification only if the new module’s `route` events are insufficient for the spike; prefer a **single** route owner (the module) to avoid double-pause. Spike then listens to `audio-session` `route` + `noisy` instead of library route callbacks for pause-on-unplug.

Prove with a log line at init: `sessionOwner=audio-session` and no library interruption subscriptions.

---

## 6. Spike wiring

**Adapter:** `apps/mobile/src/audio/session/AudioSessionController.ts` (or similar) subscribed by the spike / engine — not by route UI.

| Event | Spike / engine action |
|---|---|
| `focusChange` `lossTransient` | Fade master → suspend; remember breath resume point |
| following `gain` after transient | Resume context, re-request focus, 1 s fade-in from breath point (`bp = max(breath ≤ stoppedAt)` else 0; `resume = max(0, bp − 300)` per AUDIO_SPEC) |
| `loss` | Fade → suspend; **no** auto-resume; wait for `remote` play (or spike Play) |
| `duck` | Master −10 dB |
| `gain` after duck (no suspend) | Restore master |
| `remote` `pause` | Fade → suspend; `update(..., "paused")` |
| `remote` `play` | Re-request focus; resume after **any** pause (route, interruption, user); fix B·S2 “Start disabled until Stop→Start” by enabling resume without tearing down the mix |
| `remote` `skipBack` | Seek narration −10 s (spike: clamp to 0) |
| `noisy` | Pause; never auto-resume (wildlife); play after reconnect resumes |
| `route` → speaker after external loss | Same as noisy / today’s route-unplug |

**Mix lifecycle:** `start(meta)` when full mix starts; `update` on play/pause and metadata; `stop()` on Stop all / dispose.

**M6 engine rules (apply in `RNAudioApiEngine` in this branch):**

1. Delay `disconnect` until `onEnded` or ≥1 quantum after `stop`.
2. Never connect a source into the live graph from preload/`onLoad` side effects (MediaElement stays gated / unused in session tests).
3. Cancel overlapping `setValueCurveAtTime` before scheduling a new curve (Crossfade / duck ramps).

---

## 7. Test plan

### Unit (JS)

- Focus event mapping helpers (Android kind → director-shaped payload).
- Spike/controller state: transient loss → gain resumes; hard loss → play required; duck → gain restores level; noisy → no auto-resume; play after pause always allowed.

### Device (Jordan, release, same B·S2 setup)

| Test | Pass if |
|---|---|
| **T4** | Unplug → pause; reconnect → stays paused; lock-screen / earbud / notification **play** each resume ≤ ~1 s |
| **T5** | Call → pause; hang up → **auto** resume from breath point |
| **T6** | Other app song → pause; short notification → **duck** not pause; stop other app → play → resume + focus held (`dumpsys audio`) |
| **T7** | Lock screen title + working pause/play; audio clean |
| **T1 check** | 15 min locked; no clock/underrun regression vs B·S2 |

Record **Android run 3** in `M1-audio-test-results.md` and a dated ADR 0001 Findings bullet; **do not** change ADR Status.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| **Android 14+ FGS** — must declare `mediaPlayback` type and start FGS while “in use”; start from background can throw | Start FGS only from `start()` / play while activity or existing session is alive; catch and log; document |
| **`POST_NOTIFICATIONS`** — without it, no visible controls on API 33+ | Request before `start`; fail soft with a spike error if denied |
| **Media3 vs Compat** | Spike Media3 first; fall back to Compat if Expo/AGP conflict |
| **Double session** if library session not fully disabled | Init assert + manual `dumpsys media_session` / notification inspection |
| **Breath points** on spike fixture may be empty | Use 0 / file start; still exercise resume path |
| **Auth-gated lock screen** (B·S2) | Prefer notification shade controls while unlocked if lock auth blocks; still require earbud play |
| **Lane ownership** | Module lives under `apps/mobile` only; no `packages/shared` changes unless Claude schedules them (A6 shapes stay local adapters for now) |

---

## 9. Spec ambiguities (for Claude)

1. **Media3 vs MediaSessionCompat** — brief allows either; plan prefers Media3 unless blocked.
2. **`gain` after `duck` vs after `lossTransient`** — if both duck and transient can end with `GAIN`, JS must track “was ducked” vs “was suspended” so we don’t resume a mix that only ducked, or fail to resume one that suspended.
3. **Route ownership** — drop library route listeners entirely in favour of module `route` + `noisy`, or keep library as a secondary source?
4. **Artwork** — spike may ship without artwork; is a blank/default icon enough for T7?
5. **Skip back** with no narration playing — no-op or ignore remote?
6. Should `requestFocus` failure block `start` / play, or start muted and retry?

---

## 10. Implementation order (after plan approval)

1. Scaffold `modules/audio-session` + config plugin + app dependency.
2. FocusController + JS events + unit tests for mapping.
3. MediaSession + FGS + notification; remote events.
4. Noisy + route emitters.
5. Disable library session layer; wire spike controller + M6 engine rules.
6. Release rebuild; device protocol with Jordan; report + run 3 column.

**Stop here for plan review.**
