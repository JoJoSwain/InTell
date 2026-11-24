package expo.modules.audiosession

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper

class RouteObserver(
  context: Context,
  private val onRoute: (route: String, deviceType: String?) -> Unit,
) {
  private val audioManager =
    context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val handler = Handler(Looper.getMainLooper())
  private var callback: AudioDeviceCallback? = null

  fun start() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      emit()
      return
    }
    if (callback != null) return
    val cb =
      object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) {
          emit()
        }

        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) {
          emit()
        }
      }
    callback = cb
    audioManager.registerAudioDeviceCallback(cb, handler)
    emit()
  }

  fun stop() {
    val cb = callback ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      audioManager.unregisterAudioDeviceCallback(cb)
    }
    callback = null
  }

  private fun emit() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      onRoute("unknown", null)
      return
    }
    val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
    var hasBt = false
    var hasWired = false
    var typeName: String? = null
    for (d in devices) {
      when (d.type) {
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        AudioDeviceInfo.TYPE_BLE_HEADSET,
        AudioDeviceInfo.TYPE_BLE_SPEAKER,
        -> {
          hasBt = true
          typeName = "bluetooth"
        }
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_USB_HEADSET,
        -> {
          hasWired = true
          typeName = "headphones"
        }
      }
    }
    val route =
      when {
        hasBt -> "bluetooth"
        hasWired -> "headphones"
        else -> "speaker"
      }
    onRoute(route, typeName)
  }
}
