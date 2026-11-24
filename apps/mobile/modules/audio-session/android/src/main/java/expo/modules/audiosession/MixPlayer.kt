package expo.modules.audiosession

import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.common.util.UnstableApi
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Minimal Media3 player that mirrors the Web Audio mix state for MediaSession.
 * Actual audio is rendered by react-native-audio-api; this only advertises
 * play/pause/skip-back and metadata.
 */
@OptIn(UnstableApi::class)
class MixPlayer(
  looper: Looper,
  private val onPlay: () -> Unit,
  private val onPause: () -> Unit,
  private val onSkipBack: () -> Unit,
) : SimpleBasePlayer(looper) {
  private var playWhenReady = false
  private var title: String = "InTell"
  private var artist: String = ""
  private var positionMs: Long = 0
  /** PNG/JPEG bytes for MediaMetadata artwork (app icon). */
  private var artworkBytes: ByteArray? = null

  fun setMeta(newTitle: String, newArtist: String, artwork: ByteArray? = artworkBytes) {
    title = newTitle
    artist = newArtist
    if (artwork != null) artworkBytes = artwork
    invalidateState()
  }

  fun setPlayback(playing: Boolean, position: Long = positionMs) {
    playWhenReady = playing
    positionMs = position
    invalidateState()
  }

  override fun getState(): State {
    val metadataBuilder =
      MediaMetadata.Builder()
        .setTitle(title)
        .setArtist(artist)
    artworkBytes?.let { bytes ->
      metadataBuilder.setArtworkData(bytes, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
    }
    val metadata = metadataBuilder.build()
    val item =
      MediaItemData.Builder("intell-mix")
        .setMediaMetadata(metadata)
        .build()
    val commands =
      Player.Commands.Builder()
        .addAll(
          Player.COMMAND_PLAY_PAUSE,
          Player.COMMAND_SEEK_BACK,
          Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
          Player.COMMAND_GET_METADATA,
        )
        .build()
    return State.Builder()
      .setAvailableCommands(commands)
      .setPlayWhenReady(playWhenReady, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
      .setPlaybackState(Player.STATE_READY)
      .setPlaylist(listOf(item))
      .setCurrentMediaItemIndex(0)
      .setContentPositionMs(positionMs)
      .setSeekBackIncrementMs(10_000)
      .build()
  }

  override fun handleSetPlayWhenReady(playWhenReady: Boolean): ListenableFuture<*> {
    this.playWhenReady = playWhenReady
    if (playWhenReady) onPlay() else onPause()
    invalidateState()
    return Futures.immediateVoidFuture()
  }

  override fun handleSeek(
    mediaItemIndex: Int,
    positionMs: Long,
    seekCommand: Int,
  ): ListenableFuture<*> {
    if (seekCommand == Player.COMMAND_SEEK_BACK) {
      onSkipBack()
    }
    return Futures.immediateVoidFuture()
  }
}
