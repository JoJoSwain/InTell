import type { ConfigContext, ExpoConfig } from "expo/config";

const LINK_DOMAIN = process.env.EXPO_PUBLIC_LINK_DOMAIN ?? "intell.replaceplace.com";

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== "expo-secure-store" && name !== "expo-location";
  });
  plugins.push(["expo-secure-store", { configureAndroidBackup: false }]);
  plugins.push("./plugins/withBackupSplit");
  plugins.push("./plugins/withAudioSession");
  // Local USB walk builds only — see plugins/withLocalCleartext.ts
  plugins.push("./plugins/withLocalCleartext");
  plugins.push([
    "expo-location",
    {
      locationWhenInUsePermission:
        "This app uses your location while it is open so a story can start when you arrive. Location stays on this phone.",
      isAndroidForegroundServiceEnabled: true,
      // While Using only — do not enable isAndroidBackgroundPermissionEnabled / isIosBackgroundLocationEnabled.
    },
  ]);
  plugins.push([
    "react-native-maps",
    {
      androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID ?? "",
      iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS ?? "",
    },
  ]);
  return {
    ...config,
    name: config.name ?? "InTell",
    slug: config.slug ?? "intell",
    scheme: config.scheme ?? "intell",
    userInterfaceStyle: "automatic",
    plugins,
    ios: {
      ...config.ios,
      bundleIdentifier: config.ios?.bundleIdentifier ?? "org.replaceplace.intell",
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        UIBackgroundModes: ["audio", "location"],
      },
      associatedDomains: [`applinks:${LINK_DOMAIN}`],
    },
    android: {
      ...config.android,
      package: config.android?.package ?? "org.replaceplace.intell",
      permissions: [
        ...(config.android?.permissions ?? []),
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.POST_NOTIFICATIONS",
      ],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: LINK_DOMAIN,
              pathPrefix: "/f",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
        {
          action: "VIEW",
          data: [
            {
              scheme: "intell",
              host: "f",
              pathPrefix: "/",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    extra: {
      ...config.extra,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
      supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      linkDomain: LINK_DOMAIN,
    },
  };
};
