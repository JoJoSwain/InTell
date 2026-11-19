import { Text, View, StyleSheet } from "react-native";

export default function GrowHome() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Grow</Text>
      <Text style={styles.body}>Visit a Grove to help it grow. (M0 stub)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: "#F6F2EA" },
  title: { fontSize: 22, fontFamily: "Georgia", color: "#1F2419" },
  body: { marginTop: 12, fontSize: 16, color: "#5B6152", lineHeight: 24 },
});
