import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { getKv } from "../../src/db/repos";
import { dataLayer } from "../../src/runtime/dataLayer";
import { APPEARANCE_KEY, parseAppearance, type AppearancePreference } from "../../src/theme/appearance";
import { saveAppearance } from "../../src/theme/useMapTheme";
import { brandFont } from "../../src/ui/fonts";
import { strings } from "../../src/ui/strings";
import { tokens } from "../../src/ui/tokens";

export default function SettingsHome() {
  const [preference, setPreference] = useState<AppearancePreference>("story");
  const palette = tokens.day;

  useEffect(() => {
    let alive = true;
    void dataLayer()
      .then(({ db }) => getKv(db, APPEARANCE_KEY))
      .then((value) => {
        if (alive) setPreference(parseAppearance(value));
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
  root: { flex: 1, padding: 24, gap: 12 },
  title: { fontFamily: brandFont, fontSize: 28 },
  heading: { fontSize: 16, marginTop: 8 },
  body: { fontSize: 16, lineHeight: 24 },
  dev: { gap: 12, marginTop: 12 },
});
