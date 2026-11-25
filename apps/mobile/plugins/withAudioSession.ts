import {
  AndroidConfig,
  withAndroidManifest,
  type ConfigPlugin,
} from "expo/config-plugins";

/**
 * Ensures FOREGROUND_SERVICE / mediaPlayback permissions and the
 * MixPlaybackService declaration survive prebuild. The module's own
 * AndroidManifest merges the same entries via autolinking; this plugin
 * is the belt-and-braces copy for release builds.
 */
const withAudioSession: ConfigPlugin = (config) => {
  config = AndroidConfig.Permissions.withPermissions(config, [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    "android.permission.POST_NOTIFICATIONS",
  ]);

  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const services = application.service ?? [];
    const already = services.some(
      (s) =>
        s.$["android:name"] === "expo.modules.audiosession.MixPlaybackService",
    );
    if (!already) {
      application.service = [
        ...services,
        {
          $: {
            "android:name": "expo.modules.audiosession.MixPlaybackService",
            "android:exported": "false",
            "android:foregroundServiceType": "mediaPlayback",
          },
        },
      ];
    }
    return mod;
  });
};

export default withAudioSession;
