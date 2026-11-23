import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { installDemoGrove, installStressGrove } from "../../src/map/installFixtures";
import { counts, fetchPreview, installGrove, signIn, signOut, syncNow, type DataCounts } from "../../src/runtime/dataLayer";
import { strings } from "../../src/ui/strings";

export default function DataDevScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DataDevBody />;
}

function DataDevBody() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [groveId, setGroveId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [tally, setTally] = useState<DataCounts | null>(null);

  async function run(label: string, action: () => Promise<void>): Promise<void> {
    setStatus(label);
    try {
      await action();
      setTally(await counts());
      setStatus("Done");
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed";
      setStatus(message);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Data layer</Text>
      <Text accessibilityRole="text">{status}</Text>
      {tally ? (
        <Text accessibilityRole="text">
          {`Packs ${tally.packs}, assets ${tally.assets}, preview ${tally.preview}`}
        </Text>
      ) : null}
      <DevButton
        label="Sync"
        onPress={() => run("Syncing", () => syncNow("wifi", async () => true))}
      />
      <TextInput
        accessibilityLabel="Grove id"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setGroveId}
        placeholder="Grove id"
        style={styles.input}
        value={groveId}
      />
      <DevButton
        label="Install grove"
        onPress={() => run("Installing grove", () => installGrove(groveId.trim()))}
      />
      <DevButton label="Refresh counts" onPress={() => run("Counting", async () => undefined)} />
      <DevButton label={strings.installDemo} onPress={() => run("Installing demo", () => installDemoGrove())} />
      <DevButton
        label={strings.installStress}
        onPress={() => run("Installing stress grove", () => installStressGrove())}
      />
      <TextInput
        accessibilityLabel="Staff email"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setEmail}
        placeholder="Staff email"
        style={styles.input}
        value={email}
      />
      <TextInput
        accessibilityLabel="Staff password"
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
      />
      <DevButton
        label="Sign in"
        onPress={() => run("Signing in", () => signIn(email.trim(), password))}
      />
      <TextInput
        accessibilityLabel="Preview release id"
        autoCapitalize="none"
        onChangeText={setReleaseId}
        placeholder="Release id"
        style={styles.input}
        value={releaseId}
      />
      <DevButton
        label="Fetch preview"
        onPress={() => run("Fetching preview", () => fetchPreview(releaseId.trim()))}
      />
      <DevButton label="Sign out" onPress={() => run("Signing out", () => signOut())} />
    </View>
  );
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 12, backgroundColor: "#F6F2EA" },
  title: { fontSize: 22, fontFamily: "Georgia", color: "#1F2419" },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDD6C7",
    backgroundColor: "#FFFFFF",
    padding: 12,
    color: "#1F2419",
  },
  button: { backgroundColor: "#3F5B3A", padding: 12, alignItems: "center" },
  buttonText: { color: "#FFFFFF", fontWeight: "600" },
});
