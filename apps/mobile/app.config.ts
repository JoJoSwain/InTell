import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== "expo-secure-store";
  });
  plugins.push(["expo-secure-store", { configureAndroidBackup: false }]);
  plugins.push("./plugins/withBackupSplit");
  return {
    ...config,
    name: config.name ?? "InTell",
    slug: config.slug ?? "intell",
    plugins,
    extra: {
      ...config.extra,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
      supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    },
  };
};
