import { Text, View, StyleSheet } from "react-native";

export default function WelcomeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Stories live in places.</Text>
      <Text style={styles.body}>Walk to them to hear them.</Text>
      <Text style={styles.body}>
        The story grows with what you plant. Free, no account, works offline.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: "#F6F2EA", justifyContent: "center" },
  title: { fontSize: 28, fontFamily: "Georgia", color: "#1F2419", marginBottom: 12 },
  body: { fontSize: 17, lineHeight: 26, color: "#5B6152", marginBottom: 12 },
});
