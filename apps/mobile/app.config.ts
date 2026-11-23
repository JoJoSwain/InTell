import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== "expo-secure-store";
  });
  plugins.push(["expo-secure-store", { configureAndroidBackup: false }]);
  plugins.push("./plugins/withBackupSplit");
  plugins.push([
    "expo-location",
    {
      locationWhenInUsePermission:
        "This app uses your location while it is open so a story can start when you arrive. Location stays on this phone.",
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
    userInterfaceStyle: "automatic",
    plugins,
    extra: {
      ...config.extra,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
      supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    },
  };
};
