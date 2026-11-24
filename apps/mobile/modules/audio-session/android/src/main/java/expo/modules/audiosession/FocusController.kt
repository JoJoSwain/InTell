package expo.modules.audiosession

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper

class FocusController(
  context: Context,
  private val onChange: (kind: String, shouldResume: Boolean?) -> Unit,
) {
  private val audioManager =
    context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val handler = Handler(Looper.getMainLooper())
  private var focusRequest: AudioFocusRequest? = null
  private var held = false

  private val listener = AudioManager.OnAudioFocusChangeListener { change ->
    when (change) {
      AudioManager.AUDIOFOCUS_LOSS ->
        onChange("loss", false)
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT ->
        onChange("lossTransient", true)
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK ->
        onChange("duck", null)
      AudioManager.AUDIOFOCUS_GAIN ->
        onChange("gain", null)
    }
  }

  fun request(): Boolean {
    val attrs =
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()
    val result =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val req =
          AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attrs)
            .setOnAudioFocusChangeListener(listener, handler)
            .setWillPauseWhenDucked(false)
            .build()
        focusRequest = req
        audioManager.requestAudioFocus(req)
      } else {
        @Suppress("DEPRECATION")
        audioManager.requestAudioFocus(
          listener,
          AudioManager.STREAM_MUSIC,
          AudioManager.AUDIOFOCUS_GAIN,
        )
      }
    held = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    return held
  }

  fun abandon() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(listener)
    }
    focusRequest = null
    held = false
  }

  fun isHeld(): Boolean = held
}
