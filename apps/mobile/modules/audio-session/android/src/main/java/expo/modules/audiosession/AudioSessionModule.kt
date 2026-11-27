package expo.modules.audiosession

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.OptIn
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.toBitmap
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.ByteArrayOutputStream

class SessionMetaRecord : Record {
  @Field
  var title: String = "InTell"

  @Field
  var artist: String = ""

  @Field
  var artworkUri: String? = null
}

@OptIn(UnstableApi::class)
class AudioSessionModule : Module() {
  companion object {
    const val STOP_EXPLORING_ACTION = "stop_exploring"
    private const val TAG = "AudioSession"
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private var focusController: FocusController? = null
  private var mixPlayer: MixPlayer? = null
  private var mediaSession: MediaSession? = null
  private var noisyReceiver: BecomingNoisyReceiver? = null
  private var routeObserver: RouteObserver? = null
  private var serviceBound = false
  private var pendingStart: (() -> Unit)? = null
  private val stopExploringCommand = SessionCommand(STOP_EXPLORING_ACTION, Bundle.EMPTY)

  private val serviceConnection =
    object : ServiceConnection {
      override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
        serviceBound = true
        pendingStart?.invoke()
        pendingStart = null
      }

      override fun onServiceDisconnected(name: ComponentName?) {
        serviceBound = false
      }
    }

  override fun definition() = ModuleDefinition {
    Name("AudioSession")

    Events("focusChange", "remote", "noisy", "route")

    AsyncFunction("start") { meta: SessionMetaRecord, promise: Promise ->
      mainHandler.post {
        try {
          startSession(meta)
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("E_SESSION_START", e.message, e)
        }
      }
    }

    AsyncFunction("update") { meta: SessionMetaRecord, state: String, promise: Promise ->
      mainHandler.post {
        try {
          updateSession(meta, state)
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("E_SESSION_UPDATE", e.message, e)
        }
      }
    }

    AsyncFunction("stop") { promise: Promise ->
      mainHandler.post {
        try {
          stopSession()
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("E_SESSION_STOP", e.message, e)
        }
      }
    }

    AsyncFunction("requestFocus") { promise: Promise ->
      mainHandler.post {
        try {
          val ok = ensureFocus().request()
          promise.resolve(ok)
        } catch (e: Exception) {
          promise.reject("E_FOCUS", e.message, e)
        }
      }
    }

    AsyncFunction("abandonFocus") { promise: Promise ->
      mainHandler.post {
        try {
          focusController?.abandon()
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("E_FOCUS", e.message, e)
        }
      }
    }

    /** Non-stripped diagnostic after background ctx.resume() (review 3). */
    AsyncFunction("logContextState") { state: String ->
      android.util.Log.i(TAG, "contextState after resume: $state")
    }

    /** Release-visible breadcrumbs — Log.w survives R8 Log.i stripping (M6 review 5). */
    AsyncFunction("logBreadcrumb") { message: String ->
      android.util.Log.w("InTellAudio", message)
    }

    OnDestroy {
      mainHandler.post { stopSession() }
    }
  }

  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  private fun ensureFocus(): FocusController {
    val existing = focusController
    if (existing != null) return existing
    val fc =
      FocusController(context) { kind, shouldResume ->
        val body = mutableMapOf<String, Any?>("kind" to kind)
        if (shouldResume != null) body["shouldResume"] = shouldResume
        sendEvent("focusChange", body)
      }
    focusController = fc
    return fc
  }

  private fun startSession(meta: SessionMetaRecord) {
    val ctx = context
    ensureFocus()
    val granted = focusController!!.request()
    if (!granted) {
      android.util.Log.w("AudioSession", "focus denied at start; session still created")
    }

    if (mixPlayer == null) {
      val player =
        MixPlayer(
          Looper.getMainLooper(),
          onPlay = {
            // Media-session play is an allowed FGS start; promote before JS focus.
            MixPlaybackService.instance?.ensureForegroundForRemotePlay()
            sendEvent("remote", mapOf("command" to "play"))
          },
          onPause = { sendEvent("remote", mapOf("command" to "pause")) },
          onSkipBack = { sendEvent("remote", mapOf("command" to "skipBack")) },
        )
      mixPlayer = player
      player.setMeta(meta.title, meta.artist, loadAppIconArtwork(ctx))
      // playWhenReady=true before the service is started / session added
      // so Media3 promotes FGS inside the ~5 s window.
      player.setPlayback(true)

      val stopButton =
        CommandButton.Builder(CommandButton.ICON_STOP)
          .setDisplayName("Stop exploring")
          .setSessionCommand(stopExploringCommand)
          .setEnabled(true)
          .build()
      val session =
        MediaSession.Builder(ctx, player)
          .setId("intell-mix")
          .setCallback(
            object : MediaSession.Callback {
              override fun onConnect(
                session: MediaSession,
                controller: MediaSession.ControllerInfo,
              ): MediaSession.ConnectionResult {
                val sessionCommands =
                  MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS
                    .buildUpon()
                    .add(stopExploringCommand)
                    .build()
                return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                  .setAvailableSessionCommands(sessionCommands)
                  .setCustomLayout(listOf(stopButton))
                  .build()
              }

              override fun onCustomCommand(
                session: MediaSession,
                controller: MediaSession.ControllerInfo,
                customCommand: SessionCommand,
                args: Bundle,
              ): ListenableFuture<SessionResult> {
                if (customCommand.customAction == STOP_EXPLORING_ACTION) {
                  sendEvent("remote", mapOf("command" to "stopExploring"))
                  return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
                }
                return Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED))
              }
            },
          )
          .build()
      mediaSession = session
    } else {
      mixPlayer?.setMeta(meta.title, meta.artist, loadAppIconArtwork(ctx))
      mixPlayer?.setPlayback(true)
    }

    startServiceAndAttach()
    registerNoisy()
    startRouteObserver()
  }

  private fun startServiceAndAttach() {
    val ctx = context
    val intent = Intent(ctx, MixPlaybackService::class.java)
    // MixPlayer must already be playWhenReady=true so Media3 can promote
    // the FGS within Android's ~5 s window after startForegroundService.
    mixPlayer?.setPlayback(true)
    try {
      ContextCompat.startForegroundService(ctx, intent)
    } catch (e: Exception) {
      logForegroundServiceException("startForegroundService", e)
    }
    val attach = {
      val service = MixPlaybackService.instance
      val session = mediaSession
      // Re-assert playing right before addSession (Media3 promotion trigger).
      mixPlayer?.setPlayback(true)
      if (service != null && session != null) {
        try {
          service.attachSession(session)
        } catch (e: Exception) {
          logForegroundServiceException("attachSession", e)
        }
      }
    }
    if (MixPlaybackService.instance != null) {
      attach()
    } else {
      pendingStart = attach
      if (!serviceBound) {
        ctx.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
      }
      // Also retry shortly in case onCreate raced ahead of bind.
      mainHandler.postDelayed({
        if (MixPlaybackService.instance != null) {
          attach()
          pendingStart = null
        }
      }, 250)
    }
  }

  private fun updateSession(meta: SessionMetaRecord, state: String) {
    mixPlayer?.setMeta(meta.title, meta.artist)
    val playing = state == "playing"
    mixPlayer?.setPlayback(playing)
  }

  private fun stopSession() {
    noisyReceiver?.unregister(context)
    noisyReceiver = null
    routeObserver?.stop()
    routeObserver = null
    focusController?.abandon()
    MixPlaybackService.instance?.detachSession()
    if (serviceBound) {
      try {
        context.unbindService(serviceConnection)
      } catch (_: Exception) {
      }
      serviceBound = false
    }
    try {
      context.stopService(Intent(context, MixPlaybackService::class.java))
    } catch (_: Exception) {
    }
    mediaSession = null
    mixPlayer = null
  }

  private fun registerNoisy() {
    if (noisyReceiver != null) return
    val receiver =
      BecomingNoisyReceiver {
        sendEvent("noisy", emptyMap<String, Any>())
      }
    receiver.register(context)
    noisyReceiver = receiver
  }

  private fun startRouteObserver() {
    if (routeObserver != null) return
    val observer =
      RouteObserver(context) { route, deviceType ->
        val body = mutableMapOf<String, Any?>("route" to route)
        if (deviceType != null) body["deviceType"] = deviceType
        sendEvent("route", body)
      }
    observer.start()
    routeObserver = observer
  }

  private fun loadAppIconArtwork(ctx: Context): ByteArray? {
    return try {
      val drawable =
        ctx.packageManager.getApplicationIcon(ctx.applicationInfo)
      val bitmap =
        if (drawable is android.graphics.drawable.BitmapDrawable) {
          drawable.bitmap
        } else {
          drawable.toBitmap(
            width = 256,
            height = 256,
            config = Bitmap.Config.ARGB_8888,
          )
        }
      val out = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
      out.toByteArray()
    } catch (e: Exception) {
      android.util.Log.w("AudioSession", "app icon artwork unavailable: ${e.message}")
      null
    }
  }

  private fun logForegroundServiceException(where: String, e: Exception) {
    val name = e.javaClass.name
    val isDenied =
      (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
        e is android.app.ForegroundServiceStartNotAllowedException) ||
        name.contains("ForegroundServiceStartNotAllowed") ||
        name.contains("ForegroundServiceDidNotStartInTime")
    if (isDenied) {
      android.util.Log.e(
        "AudioSession",
        "$where: foreground service refused ($name): ${e.message}",
        e,
      )
    } else {
      android.util.Log.e("AudioSession", "$where refused: ${e.message}", e)
    }
  }
}
