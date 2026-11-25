import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { getKv, setKv } from "../../src/db/repos";
import { dataLayer } from "../../src/runtime/dataLayer";
import { useExploringRuntime } from "../../src/session/ExploringProvider";
import {
  ACCESSIBLE_TRIGGER_KEY,
  BEACONS_ENABLED_KEY,
  LOCATION_AVAILABLE_KEY,
  parseBoolKv,
} from "../../src/session/settingsKeys";
import { APPEARANCE_KEY, parseAppearance, type AppearancePreference } from "../../src/theme/appearance";
import { saveAppearance } from "../../src/theme/useMapTheme";
import { brandFont } from "../../src/ui/fonts";
import { strings } from "../../src/ui/strings";
import { tokens } from "../../src/ui/tokens";

export default function SettingsHome() {
  const runtime = useExploringRuntime();
  const [preference, setPreference] = useState<AppearancePreference>("story");
  const [accessible, setAccessible] = useState(false);
  const [locationOn, setLocationOn] = useState(true);
  const [beacons, setBeacons] = useState(false);
  const palette = tokens.day;

  useEffect(() => {
    let alive = true;
    void dataLayer()
      .then(async ({ db }) => {
        const appearance = parseAppearance(await getKv(db, APPEARANCE_KEY));
        const a = parseBoolKv(await getKv(db, ACCESSIBLE_TRIGGER_KEY), false);
        const loc = parseBoolKv(await getKv(db, LOCATION_AVAILABLE_KEY), true);
        const b = parseBoolKv(await getKv(db, BEACONS_ENABLED_KEY), false);
        if (!alive) return;
        setPreference(appearance);
        setAccessible(a);
        setLocationOn(loc);
        setBeacons(b);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function choose(next: AppearancePreference): Promise<void> {
    setPreference(next);
    await saveAppearance(next);
  }

  async function toggle(
    key: string,
    value: boolean,
    setLocal: (v: boolean) => void,
  ): Promise<void> {
    setLocal(value);
    const { db } = await dataLayer();
    await setKv(db, key, value ? "1" : "0");
    await runtime?.reloadSettings();
    if (key === ACCESSIBLE_TRIGGER_KEY || key === LOCATION_AVAILABLE_KEY) {
      await runtime?.dispatch({
        type: "settingsChanged",
        at: Date.now(),
        accessibleTrigger: key === ACCESSIBLE_TRIGGER_KEY ? value : accessible,
        locationAvailable: key === LOCATION_AVAILABLE_KEY ? value : locationOn,
      });
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <Text maxFontSizeMultiplier={2} style={[styles.title, { color: palette.text }]}>
        {strings.settings}
      </Text>
      <Text maxFontSizeMultiplier={2} style={[styles.heading, { color: palette.text }]}>
        {strings.appearance}
      </Text>
      <Choice
        label={strings.matchStory}
        selected={preference === "story"}
        onPress={() => void choose("story")}
      />
      <Choice
        label={strings.followPhone}
        selected={preference === "phone"}
        onPress={() => void choose("phone")}
      />
      <Text maxFontSizeMultiplier={2} style={[styles.heading, { color: palette.text, marginTop: 24 }]}>
        Exploring
      </Text>
      <Choice
        label={strings.accessibleTrigger}
        selected={accessible}
        onPress={() => void toggle(ACCESSIBLE_TRIGGER_KEY, !accessible, setAccessible)}
      />
      <Choice
        label={strings.locationAvailable}
        selected={locationOn}
        onPress={() => void toggle(LOCATION_AVAILABLE_KEY, !locationOn, setLocationOn)}
      />
      <Choice
        label={strings.beaconsPref}
        selected={beacons}
        onPress={() => void toggle(BEACONS_ENABLED_KEY, !beacons, setBeacons)}
      />
      <Text maxFontSizeMultiplier={2} style={[styles.body, { color: palette.textMuted }]}>
        {strings.settingsLater}
      </Text>
      {__DEV__ ? (
        <View style={styles.dev}>
          <Link href="/dev/data" accessibilityLabel={strings.devData}>
            {strings.devData}
          </Link>
          <Link href="/dev/audio-spike" accessibilityLabel={strings.devAudio}>
            {strings.devAudio}
          </Link>
        </View>
      ) : null}
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onPress}>
      <Text maxFontSizeMultiplier={2} style={{ color: tokens.day.text }}>
        {selected ? "● " : "○ "}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 8 },
  title: { fontSize: 28, fontFamily: brandFont, marginBottom: 8 },
  heading: { fontSize: 18, marginTop: 8 },
  body: { marginTop: 16, fontSize: 15 },
  dev: { marginTop: 24, gap: 8 },
});
