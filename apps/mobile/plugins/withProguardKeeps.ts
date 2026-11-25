/**
 * Append R8 keep rules that release minify needs (WorkManager/Room used by
 * expo-task-manager / expo-location). Survives `expo prebuild --clean`.
 */
import {
  createRunOncePlugin,
  withDangerousMod,
  type ConfigPlugin,
} from "expo/config-plugins";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MARKER = "# intell-proguard-keeps";

const RULES = `
${MARKER}
# WorkManager / Room (expo-task-manager, expo-location FGS)
-keep class androidx.work.** { *; }
-keep class androidx.work.impl.** { *; }
-keep interface androidx.work.impl.** { *; }
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class * extends androidx.work.Worker { *; }
-keep class * extends androidx.work.ListenableWorker { *; }
-dontwarn androidx.work.**
-dontwarn androidx.room.**

# Local audio-session module (Media3 + Expo modules)
-keep class expo.modules.audiosession.** { *; }

# Do not strip InTellAudio Log.w breadcrumbs (R8 often strips Log.i/v/d only)
-keepclassmembers class android.util.Log {
    public static *** w(...);
}
`;

const withProguardKeeps: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "android",
    async (cfg) => {
      const file = join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "proguard-rules.pro",
      );
      if (!existsSync(file)) return cfg;
      const current = readFileSync(file, "utf8");
      if (current.includes(MARKER)) return cfg;
      writeFileSync(file, `${current.trimEnd()}\n${RULES}\n`, "utf8");
      return cfg;
    },
  ]);

export default createRunOncePlugin(
  withProguardKeeps,
  "withProguardKeeps",
  "1.0.0",
);
