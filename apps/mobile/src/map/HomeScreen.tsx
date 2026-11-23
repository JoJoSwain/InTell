import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type MapView from "react-native-maps";
import { listCompletions, listPacks, listUnlocks } from "../db/repos";
import { dataLayer } from "../runtime/dataLayer";
import { pointInGrove } from "./groves";
import { HomeMap, fallbackCamera } from "./HomeMap";
import { modelsFromPacks, type HomeModel } from "./homeModel";
import { useMapTheme } from "../theme/useMapTheme";
import { brandFont } from "../ui/fonts";
import { useReduceMotion } from "../ui/reduceMotion";
import { strings } from "../ui/strings";
import { tokens, type MapThemeName } from "../ui/tokens";

const EMPTY: HomeModel = {
  groves: [],
  markers: [],
  links: [],
  sunReference: null,
  timeZone: null,
};

export function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [model, setModel] = useState<HomeModel>(EMPTY);
  const theme = useMapTheme({
    hasRegion: model.timeZone !== null && model.sunReference !== null,
    sunReference: model.sunReference,
    timeZone: model.timeZone,
  });
  const [permission, setPermission] = useState<"unknown" | "prompt" | "granted" | "denied">("unknown");
  const [user, setUser] = useState<{ latitude: number; longitude: number } | null>(null);
  const [away, setAway] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetGroveId, setSheetGroveId] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const placed = useRef(false);

  const load = useCallback((timeWindow: "day" | "night") => {
    let alive = true;
    void dataLayer()
      .then(async ({ db }) => {
        const next = modelsFromPacks(
          await listPacks(db),
          await listCompletions(db),
          await listUnlocks(db),
          timeWindow,
        );
        if (alive) setModel(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => load(theme), [load, theme]);
  useFocusEffect(useCallback(() => load(theme), [load, theme]));

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then((result) => {
      if (result.granted) setPermission("granted");
      else if (!result.canAskAgain) setPermission("denied");
      else setPermission("prompt");
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || placed.current || permission === "unknown" || permission === "prompt") return;
    if (permission !== "granted" && model.groves.length === 0 && model.sunReference === null) return;
    placed.current = true;
    void (async () => {
      if (permission === "granted") {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUser(next);
        map.animateToRegion({ ...next, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 0);
        return;
      }
      const grove = model.groves.find((item) => item.centroid);
      if (grove?.centroid) {
        map.animateToRegion({ ...grove.centroid, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 0);
        return;
      }
      if (model.sunReference) {
        map.animateToRegion({
          latitude: model.sunReference.lat,
          longitude: model.sunReference.lng,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        }, 0);
      }
    })();
  }, [model, permission]);

  const palette = tokens[theme];
  const selected = model.markers.find((marker) => marker.id === selectedId) ?? null;
  const sheet = model.groves.find((grove) => grove.id === sheetGroveId) ?? null;
  const inside =
    user === null
      ? null
      : (model.groves.find((grove) =>
          pointInGrove({ lat: user.latitude, lng: user.longitude }, grove.pieces),
        ) ?? null);

  async function allowLocation(): Promise<void> {
    const result = await Location.requestForegroundPermissionsAsync();
    setPermission(result.granted ? "granted" : "denied");
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <StatusBar style={theme === "night" ? "light" : "dark"} />
      <HomeMap
        theme={theme}
        groves={model.groves}
        markers={model.markers}
        links={model.links}
        showUser={permission === "granted"}
        reduceMotion={reduceMotion}
        initialTarget={fallbackCamera}
        user={user}
        onReady={(map) => {
          mapRef.current = map;
        }}
        onSelectMarker={(id) => {
          setSelectedId(id);
          setSheetGroveId(null);
        }}
        onPressMap={() => {
          setSelectedId(null);
          setSheetGroveId(null);
        }}
        onUserMoved={setAway}
      />
      {__DEV__ ? (
        <Text style={[styles.devMark, { top: insets.top + 16, color: palette.textMuted }]} accessibilityElementsHidden>
          {strings.devWordmark}
        </Text>
      ) : (
        <View style={[styles.devMark, { top: insets.top + 16 }]} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.settingsButton}
        onPress={() => router.push("/settings")}
        style={[styles.settings, { top: insets.top + 12, borderColor: palette.chipBorder, backgroundColor: palette.chip }]}
      >
        <View style={[styles.settingsLine, { backgroundColor: palette.text }]} />
        <View style={[styles.settingsLine, { backgroundColor: palette.text }]} />
        <View style={[styles.settingsLine, { backgroundColor: palette.text }]} />
      </Pressable>
      {inside ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={inside.name}
          onPress={() => {
            setSheetGroveId(inside.id);
            setSelectedId(null);
          }}
          style={[styles.chipWrap, { top: insets.top + 70 }]}
        >
          <View style={[styles.chip, chrome(theme)]}>
            <Text maxFontSizeMultiplier={2} numberOfLines={1} style={[styles.chipText, { color: palette.text }]}>
              {inside.name}
            </Text>
            <Text style={{ color: palette.text }}>⌄</Text>
          </View>
        </Pressable>
      ) : null}
      {permission === "prompt" ? (
        <View style={[styles.card, chrome(theme), { bottom: insets.bottom + 150 }]}>
          <Text maxFontSizeMultiplier={2} style={[styles.body, { color: palette.text }]}>
            {strings.locationExplainer}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={strings.locationContinue} onPress={() => void allowLocation()}>
            <Text maxFontSizeMultiplier={2} style={[styles.brand, { color: palette.primary }]}>
              {strings.locationContinue}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {selected ? (
        <View style={[styles.card, chrome(theme), { bottom: insets.bottom + 150 }]}>
          <Text maxFontSizeMultiplier={2} style={[styles.body, { color: palette.text }]}>
            {selected.card}
          </Text>
        </View>
      ) : null}
      {sheet ? (
        <View style={[styles.card, chrome(theme), { bottom: insets.bottom + 150 }]}>
          <Text maxFontSizeMultiplier={2} style={[styles.brand, { color: palette.text }]}>
            {sheet.name}
          </Text>
          <Text maxFontSizeMultiplier={2} style={[styles.body, { color: palette.text }]}>
            {sheet.premise}
          </Text>
        </View>
      ) : null}
      {away && user ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.recenter}
          onPress={() =>
            mapRef.current?.animateToRegion({ ...user, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 250)
          }
          style={[styles.recenter, chrome(theme), { bottom: insets.bottom + 112 }]}
        >
          <Text style={{ color: palette.text }}>◎</Text>
        </Pressable>
      ) : null}
      <View style={[styles.row, { bottom: insets.bottom + 34 }]}>
        <Pill href="/chronicle" label={strings.chronicle} theme={theme} />
        <Pill href="/embark" label={strings.embark} theme={theme} embark />
        <Pill href="/journal" label={strings.journal} theme={theme} />
      </View>
    </View>
  );
}

function Pill({
  href,
  label,
  theme,
  embark,
}: {
  href: "/chronicle" | "/embark" | "/journal";
  label: string;
  theme: MapThemeName;
  embark?: boolean;
}) {
  const router = useRouter();
  const palette = tokens[theme];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={[
        embark ? styles.embark : styles.pill,
        embark
          ? { backgroundColor: palette.primary }
          : chrome(theme),
      ]}
    >
      <Text
        maxFontSizeMultiplier={2}
        numberOfLines={1}
        style={[
          embark ? styles.embarkText : styles.pillText,
          { color: embark ? palette.onPrimary : palette.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function chrome(theme: MapThemeName) {
  const palette = tokens[theme];
  if (theme === "night") {
    return { backgroundColor: palette.chip, borderColor: palette.chipBorder, borderWidth: 1 };
  }
  return {
    backgroundColor: palette.chip,
    borderColor: palette.chipBorder,
    borderWidth: 1,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
    elevation: 2,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  devMark: { position: "absolute", left: 16, fontSize: 14 },
  settings: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  settingsLine: { width: 16, height: 2 },
  chipWrap: { position: "absolute", left: 72, right: 72, alignItems: "center" },
  chip: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { fontFamily: brandFont, fontSize: 17, maxWidth: 220 },
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  brand: { fontFamily: brandFont, fontSize: 20 },
  body: { fontSize: 16, lineHeight: 22 },
  recenter: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  pill: { flex: 1, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  embark: { flex: 1.15, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 8, paddingHorizontal: 16 },
  pillText: { fontFamily: brandFont, fontSize: 16 },
  embarkText: { fontFamily: brandFont, fontSize: 19 },
});
