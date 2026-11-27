import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useExploringRuntime } from "../../src/session/ExploringProvider";
import { tokens } from "../../src/ui/tokens";

/** Physical-marker QR / universal link / intell://f/{code} → session scan. */
export default function PhysicalMarkerScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const runtime = useExploringRuntime();
  const router = useRouter();
  const invalid = !code || typeof code !== "string";
  const [status, setStatus] = useState<"pending" | "done" | "error">(
    invalid ? "error" : "pending",
  );

  useEffect(() => {
    if (invalid || !runtime) return;
    let alive = true;
    void runtime
      .scanCode(code)
      .then(() => {
        if (!alive) return;
        setStatus("done");
        router.replace("/");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [code, invalid, runtime, router]);

  const palette = tokens.day;
  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {status === "pending" ? <ActivityIndicator /> : null}
      {status === "error" ? (
        <Text style={{ color: palette.text }}>Could not open that marker.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
