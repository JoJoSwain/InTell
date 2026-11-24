package expo.modules.audiosession

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Build

class BecomingNoisyReceiver(
  private val onNoisy: () -> Unit,
) : BroadcastReceiver() {
  private var registered = false

  override fun onReceive(context: Context?, intent: Intent?) {
    if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
      onNoisy()
    }
  }

  fun register(context: Context) {
    if (registered) return
    val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(this, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      context.registerReceiver(this, filter)
    }
    registered = true
  }

  fun unregister(context: Context) {
    if (!registered) return
    try {
      context.unregisterReceiver(this)
    } catch (_: Exception) {
      // ignore
    }
    registered = false
  }
}
