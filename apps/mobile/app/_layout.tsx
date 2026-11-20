import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

/**
 * M0 shell. Map is home; Journal / Grow / Settings are modal stacks (TECH_SPEC §2).
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ presentation: "modal", title: "Welcome" }} />
        <Stack.Screen name="journal/index" options={{ presentation: "modal", title: "Journal" }} />
        <Stack.Screen name="grow/index" options={{ presentation: "modal", title: "Grow" }} />
        <Stack.Screen name="settings/index" options={{ presentation: "modal", title: "Settings" }} />
        <Stack.Screen name="f/[code]" options={{ title: "Fragment" }} />
        <Stack.Screen
          name="dev/audio-spike"
          options={{ title: "Audio spike", headerShown: true }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
