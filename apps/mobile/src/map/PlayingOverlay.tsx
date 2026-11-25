/**
 * Playing overlay (M6 §6, Jordan-approved): dimmed map, title, tier, progress,
 * "Look up…", pause/play, back 10 s — no start button.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { brandFont } from "../ui/fonts";
import { strings } from "../ui/strings";
import { tokens } from "../ui/tokens";

export type PlayingOverlayProps = {
  title: string;
  tier: "root" | "branch" | "leaf";
  progress: number;
  paused: boolean;
  /** Optional focus-denied / busy line under Look up. */
  busyHint?: string;
  onTogglePause: () => void;
  onBack10: () => void;
};

function tierLabel(tier: PlayingOverlayProps["tier"]): string {
  if (tier === "root") return strings.tierRoot;
  if (tier === "branch") return strings.tierBranch;
  return strings.tierLeaf;
}

export function PlayingOverlay(props: PlayingOverlayProps) {
  const palette = tokens.day;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { backgroundColor: "rgba(27, 42, 51, 0.7)" }]}
      accessibilityViewIsModal={true}
    >
      <Text
        maxFontSizeMultiplier={2}
        style={[styles.title, { color: palette.surface, fontFamily: brandFont }]}
        accessibilityRole="header"
      >
        {props.title}
      </Text>
      <Text maxFontSizeMultiplier={2} style={[styles.tier, { color: palette.surface }]}>
        {tierLabel(props.tier)}
      </Text>
      <View style={styles.track} accessibilityLabel={strings.progress}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(Math.min(1, Math.max(0, props.progress)) * 100)}%` },
          ]}
        />
      </View>
      <Text maxFontSizeMultiplier={2} style={[styles.copy, { color: palette.surface }]}>
        {strings.lookUp}
      </Text>
      {props.busyHint ? (
        <Text
          maxFontSizeMultiplier={2}
          style={[styles.copy, { color: palette.surface, opacity: 0.95 }]}
          accessibilityRole="text"
        >
          {props.busyHint}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.paused ? strings.resumeNarration : strings.pauseNarration}
          onPress={props.onTogglePause}
          style={styles.btn}
        >
          <Text style={styles.btnText}>{props.paused ? strings.resumeNarration : strings.pauseNarration}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.back10}
          onPress={props.onBack10}
          style={styles.btn}
        >
          <Text style={styles.btnText}>{strings.back10}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  title: { fontSize: 28, textAlign: "center" },
  tier: { marginTop: 8, fontSize: 16, opacity: 0.9 },
  track: {
    marginTop: 20,
    alignSelf: "stretch",
    height: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: { height: 3, backgroundColor: "#8FAE91" },
  copy: { marginTop: 20, fontSize: 16, textAlign: "center" },
  row: { marginTop: 28, flexDirection: "row", gap: 16 },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  btnText: { color: "#FFFDF9", fontSize: 16 },
});
