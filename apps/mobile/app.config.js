/**
 * Expo config — reads Google Maps API key from env at prebuild time.
 * Paste the Android Maps SDK key into apps/mobile/.env as:
 *   GOOGLE_MAPS_API_KEY=your_key_here
 * Then prebuild/rebuild when ready: npx expo prebuild --platform android
 *
 * app.json alone cannot interpolate env vars into the native plugin.
 */
export default ({ config }) => {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";

  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== "react-native-maps" && name !== "expo-location";
  });

  plugins.push([
    "expo-location",
    {
      locationWhenInUsePermission:
        "InTell uses your location to play each story when you reach it. Your location stays on your phone.",
    },
  ]);

  plugins.push([
    "react-native-maps",
    {
      // Empty string keeps wiring intact; map tiles need a real key on device builds.
      androidGoogleMapsApiKey: mapsKey,
    },
  ]);

  return {
    ...config,
    android: {
      ...config.android,
      permissions: [
        ...new Set([
          ...(config.android?.permissions ?? []),
          "ACCESS_COARSE_LOCATION",
          "ACCESS_FINE_LOCATION",
        ]),
      ],
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: {
          apiKey: mapsKey,
        },
      },
    },
    plugins,
    extra: {
      ...(config.extra ?? {}),
      hasGoogleMapsApiKey: Boolean(mapsKey),
    },
  };
};
