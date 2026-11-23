import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { dataLayer } from "../src/runtime/dataLayer";
import { strings } from "../src/ui/strings";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Questrial: require("../assets/fonts/Questrial-Regular.ttf"),
  });
  useEffect(() => {
    void dataLayer().catch(() => {
      console.info("data layer failed to start");
    });
  }, []);
  if (!fontsLoaded) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ presentation: "modal", title: "Welcome" }} />
        <Stack.Screen name="journal/index" options={{ presentation: "modal", title: strings.journal }} />
        <Stack.Screen name="chronicle/index" options={{ presentation: "modal", title: strings.chronicle }} />
        <Stack.Screen name="embark/index" options={{ presentation: "modal", title: strings.embark }} />
        <Stack.Screen name="settings/index" options={{ presentation: "modal", title: strings.settings }} />
        <Stack.Screen name="f/[code]" options={{ title: "Fragment" }} />
        <Stack.Screen
          name="dev/audio-spike"
          options={{ title: strings.devAudio, headerShown: true }}
        />
        <Stack.Screen name="dev/data" options={{ title: strings.devData, headerShown: true }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
