package expo.modules.audiosession

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.annotation.OptIn
import androidx.core.app.NotificationCompat
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Foreground mediaPlayback service that hosts the Media3 MediaSession.
 * Session + notification stay alive while paused; torn down only on stop.
 */
@OptIn(UnstableApi::class)
class MixPlaybackService : MediaSessionService() {
  companion object {
    const val CHANNEL_ID = "intell_audio_session"
    const val NOTIFICATION_ID = 41001
    var instance: MixPlaybackService? = null
      private set
  }

  private var mediaSession: MediaSession? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    ensureChannel()
  }

  fun attachSession(session: MediaSession) {
    mediaSession = session
    addSession(session)
    promoteForeground(session)
  }

  fun detachSession() {
    mediaSession?.let { removeSession(it) }
    mediaSession?.release()
    mediaSession = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
    mediaSession

  override fun onDestroy() {
    mediaSession?.release()
    mediaSession = null
    instance = null
    super.onDestroy()
  }

  private fun promoteForeground(session: MediaSession) {
    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    val launch =
      packageManager.getLaunchIntentForPackage(packageName)?.let { intent ->
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        PendingIntent.getActivity(
          this,
          0,
          intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
      }
    val title =
      session.player.mediaMetadata.title?.toString() ?: "InTell"
    val artist =
      session.player.mediaMetadata.artist?.toString() ?: ""
    val notification =
      NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle(title)
        .setContentText(artist.ifEmpty { "Playing" })
        .setSmallIcon(applicationInfo.icon)
        .setContentIntent(launch)
        .setOngoing(true)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setSilent(true)
        .build()
    try {
      startForeground(NOTIFICATION_ID, notification)
    } catch (e: Exception) {
      // Android 14+ may refuse FGS from background; log for device protocol.
      android.util.Log.e("AudioSession", "startForeground refused: ${e.message}", e)
      nm.notify(NOTIFICATION_ID, notification)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        "InTell playback",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Lock-screen and notification media controls"
        setShowBadge(false)
      }
    nm.createNotificationChannel(channel)
  }
}
