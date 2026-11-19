import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops" }} />
      <View style={styles.root}>
        <Text style={styles.title}>Screen not found</Text>
        <Link href="/">
          <Text style={styles.link}>Back to map</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 20, marginBottom: 12 },
  link: { color: "#3F5B3A" },
});
