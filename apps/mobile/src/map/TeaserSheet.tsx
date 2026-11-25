/**
 * Locked / wrong-time teaser sheet — teaser text only (never title/transcript/audio).
 */
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { strings } from "../ui/strings";
import { tokens } from "../ui/tokens";

export type TeaserSheetProps = {
  teaserText: string;
  changeTeaser?: string;
  otherTimeHint?: string;
  onClose: () => void;
};

export function TeaserSheet(props: TeaserSheetProps) {
  const palette = tokens.day;
  return (
    <Modal transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose} accessibilityLabel={strings.teaserClose}>
        <View />
      </Pressable>
      <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
        <Text maxFontSizeMultiplier={2} style={[styles.body, { color: palette.text }]}>
          {props.teaserText}
        </Text>
        {props.changeTeaser ? (
          <Text maxFontSizeMultiplier={2} style={[styles.secondary, { color: palette.textMuted }]}>
            {props.changeTeaser}
          </Text>
        ) : null}
        {props.otherTimeHint ? (
          <Text maxFontSizeMultiplier={2} style={[styles.secondary, { color: palette.textMuted }]}>
            {props.otherTimeHint}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.teaserClose}
          onPress={props.onClose}
          style={styles.close}
        >
          <Text style={{ color: palette.primary }}>{strings.closeCard}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  body: { fontSize: 17, lineHeight: 24 },
  secondary: { marginTop: 12, fontSize: 15, lineHeight: 22 },
  close: { marginTop: 20, alignSelf: "flex-start" },
});
