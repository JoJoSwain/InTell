package expo.modules.audiosession

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.OptIn
import androidx.core.content.ContextCompat
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaSession
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

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
  private val mainHandler = Handler(Looper.getMainLooper())
  private var focusController: FocusController? = null
  private var mixPlayer: MixPlayer? = null
  private var mediaSession: MediaSession? = null
  private var noisyReceiver: BecomingNoisyReceiver? = null
  private var routeObserver: RouteObserver? = null
  private var serviceBound = false
  private var pendingStart: (() -> Unit)? = null

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
          onPlay = { sendEvent("remote", mapOf("command" to "play")) },
          onPause = { sendEvent("remote", mapOf("command" to "pause")) },
          onSkipBack = { sendEvent("remote", mapOf("command" to "skipBack")) },
        )
      mixPlayer = player
      player.setMeta(meta.title, meta.artist)
      player.setPlayback(true)

      val session =
        MediaSession.Builder(ctx, player)
          .setId("intell-mix")
          .build()
      mediaSession = session
    } else {
      mixPlayer?.setMeta(meta.title, meta.artist)
      mixPlayer?.setPlayback(true)
    }

    startServiceAndAttach()
    registerNoisy()
    startRouteObserver()
  }

  private fun startServiceAndAttach() {
    val ctx = context
    val intent = Intent(ctx, MixPlaybackService::class.java)
    try {
      ContextCompat.startForegroundService(ctx, intent)
    } catch (e: Exception) {
      android.util.Log.e("AudioSession", "startForegroundService refused: ${e.message}", e)
    }
    val attach = {
      val service = MixPlaybackService.instance
      val session = mediaSession
      if (service != null && session != null) {
        service.attachSession(session)
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
}
