package expo.modules.audiosession

import android.app.ForegroundServiceStartNotAllowedException
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Hosts the Media3 MediaSession. MediaSessionService + DefaultMediaNotificationProvider
 * own the media-style notification and foreground promotion (no hand-built NotificationCompat).
 */
@OptIn(UnstableApi::class)
class MixPlaybackService : MediaSessionService() {
  companion object {
    const val CHANNEL_ID = "intell_audio_session"
    const val NOTIFICATION_ID = 41001
    private const val TAG = "AudioSession"
    var instance: MixPlaybackService? = null
      private set
  }

  private var mediaSession: MediaSession? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    ensureChannel()
    val provider =
      DefaultMediaNotificationProvider.Builder(this)
        .setChannelId(CHANNEL_ID)
        .setChannelName(R.string.intell_audio_session_channel)
        .setNotificationId(NOTIFICATION_ID)
        .build()
    // App icon as the small icon (review: title/artist/app icon).
    provider.setSmallIcon(applicationInfo.icon)
    setMediaNotificationProvider(provider)
  }

  fun attachSession(session: MediaSession) {
    // Caller must set playWhenReady=true before addSession so Media3
    // promotes to foreground within Android's ~5 s window.
    mediaSession = session
    try {
      addSession(session)
    } catch (e: Exception) {
      logForegroundFailure("addSession", e)
      throw e
    }
  }

  fun detachSession() {
    mediaSession?.let { removeSession(it) }
    mediaSession?.release()
    mediaSession = null
    stopSelf()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
    mediaSession

  override fun onUpdateNotification(
    session: MediaSession,
    startInForegroundRequired: Boolean,
  ) {
    try {
      super.onUpdateNotification(session, startInForegroundRequired)
    } catch (e: Exception) {
      logForegroundFailure("onUpdateNotification", e)
    }
  }

  override fun onDestroy() {
    mediaSession?.release()
    mediaSession = null
    instance = null
    super.onDestroy()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        getString(R.string.intell_audio_session_channel),
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Lock-screen and notification media controls"
        setShowBadge(false)
      }
    nm.createNotificationChannel(channel)
  }

  private fun logForegroundFailure(where: String, e: Exception) {
    val name = e.javaClass.name
    val isDenied =
      (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
        e is ForegroundServiceStartNotAllowedException) ||
        name.contains("ForegroundServiceStartNotAllowed") ||
        name.contains("ForegroundServiceDidNotStartInTime")
    if (isDenied) {
      android.util.Log.e(TAG, "$where: foreground service refused ($name): ${e.message}", e)
    } else {
      android.util.Log.e(TAG, "$where failed: ${e.message}", e)
    }
  }
}
