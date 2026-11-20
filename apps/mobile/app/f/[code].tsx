import { useLocalSearchParams } from "expo-router";
import { Text, View, StyleSheet } from "react-native";

/** Protected fragment QR entry — universal links wired in M6. */
export default function ProtectedFragmentScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Protected fragment</Text>
      <Text style={styles.body}>Code hash match lands in M6. Demo code: {code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: "#F6F2EA" },
  title: { fontSize: 22, fontFamily: "Georgia", color: "#1F2419" },
  body: { marginTop: 12, fontSize: 16, color: "#5B6152" },
});
