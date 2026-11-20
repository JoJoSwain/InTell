import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { L10n, pickL10n } from "@intell/shared";

const groveName = L10n.parse({
  en: "Map home (M0 stub)",
  es: "Mapa (esqueleto M0)",
});

/**
 * PRODUCT_SPEC §4 — the map is home.
 * M0: placeholder surface + bottom bar. MapLibre lands in M5.
 */
export default function MapHomeScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.mapStub}>
        <Text style={styles.brand}>InTell</Text>
        <Text style={styles.sub}>Replaceplace</Text>
        <Text style={styles.body}>{pickL10n(groveName, "en")}</Text>
        <Text style={styles.muted}>
          Grove polygons, Root/Branch/Leaf markers, and packs arrive in later
          milestones. No nearby lists — the map is the interface.
        </Text>
      </View>

      <View style={styles.chip}>
        <Text style={styles.chipText}>Outside a Grove · Stop idle</Text>
      </View>

      <View style={styles.bar}>
        <BarLink href="/journal" label="Journal" />
        <BarLink href="/grow" label="Grow" />
        <BarLink href="/settings" label="Settings" />
      </View>
    </View>
  );
}

function BarLink({ href, label }: { href: "/journal" | "/grow" | "/settings"; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.barBtn} accessibilityRole="button">
        <Text style={styles.barLabel}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F6F2EA" },
  mapStub: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: 24,
    justifyContent: "flex-start",
  },
  brand: {
    fontSize: 34,
    fontWeight: "600",
    color: "#1F2419",
    fontFamily: "Georgia",
  },
  sub: {
    marginTop: 4,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontSize: 12,
    color: "#3F5B3A",
  },
  body: { marginTop: 24, fontSize: 18, color: "#1F2419", lineHeight: 26 },
  muted: { marginTop: 12, fontSize: 15, color: "#5B6152", lineHeight: 22 },
  chip: {
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDD6C7",
  },
  chipText: { color: "#5B6152", fontSize: 13 },
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#DDD6C7",
    backgroundColor: "#FFFFFF",
    paddingBottom: 28,
    paddingTop: 10,
  },
  barBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  barLabel: { fontSize: 15, fontWeight: "600", color: "#1F2419" },
});
