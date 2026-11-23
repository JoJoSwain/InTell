import { StyleSheet, Text, View } from "react-native";
import { brandFont } from "../../src/ui/fonts";
import { strings } from "../../src/ui/strings";
import { tokens } from "../../src/ui/tokens";

export default function EmbarkHome() {
  return (
    <View style={[styles.root, { backgroundColor: tokens.day.bg }]}>
      <Text maxFontSizeMultiplier={2} style={[styles.title, { color: tokens.day.text }]}>
        {strings.embark}
      </Text>
      <Text maxFontSizeMultiplier={2} style={[styles.body, { color: tokens.day.textMuted }]}>
        {strings.embarkLater}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  title: { fontFamily: brandFont, fontSize: 28 },
  body: { marginTop: 12, fontSize: 16, lineHeight: 24 },
});
