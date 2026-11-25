import { StyleSheet, Text, View } from "react-native";
import { strings } from "../ui/strings";
import { tokens } from "../ui/tokens";

export function AfterglowBanner(props: { showUnlockLine: boolean }) {
  if (!props.showUnlockLine) return null;
  const palette = tokens.day;
  return (
    <View style={[styles.wrap, { backgroundColor: palette.surface }]} pointerEvents="none">
      <Text maxFontSizeMultiplier={2} style={[styles.text, { color: palette.text }]}>
        {strings.somethingNew}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 120,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: { fontSize: 15, textAlign: "center" },
});
