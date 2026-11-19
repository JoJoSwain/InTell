import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "expo-router";
import * as Location from "expo-location";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import MapView, {
  Marker,
  Polygon,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "../ui/tokens";
import {
  DEMO_GROVE,
  DEMO_GROVE_POLYGON,
  DEMO_INITIAL_REGION,
  DEMO_ROOTS,
  MUTED_GOOGLE_MAP_STYLE,
} from "./demoContent";

type SessionChip = "outside" | "near";

/**
 * PRODUCT_SPEC §4 home map — Google Maps base (JoJo preference 2026-11-19).
 * Eyes-up chrome: puck, recenter, session chip, Journal · Grow · Settings.
 */
export function MapHome() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [permission, setPermission] =
    useState<Location.PermissionStatus | null>(null);
  const [userCoord, setUserCoord] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [chip, setChip] = useState<SessionChip>("outside");

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setPermission(status);
      if (status !== Location.PermissionStatus.GRANTED) return;

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cancelled) return;
      const coord = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setUserCoord(coord);
      setChip(pointInDemoGrove(coord) ? "near" : "outside");

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 15,
          timeInterval: 5000,
        },
        (fix) => {
          const next = {
            latitude: fix.coords.latitude,
            longitude: fix.coords.longitude,
          };
          setUserCoord(next);
          setChip(pointInDemoGrove(next) ? "near" : "outside");
        },
      );
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  const onRecenter = useCallback(() => {
    const target: Region = userCoord
      ? {
          latitude: userCoord.latitude,
          longitude: userCoord.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }
      : DEMO_INITIAL_REGION;
    mapRef.current?.animateToRegion(target, 400);
  }, [userCoord]);

  const chipLabel =
    chip === "near"
      ? `Exploring ${DEMO_GROVE.name} · Stop`
      : "Head to a Grove to begin.";

  const bottomPad = Math.max(insets.bottom, space.lg);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEMO_INITIAL_REGION}
        customMapStyle={MUTED_GOOGLE_MAP_STYLE}
        showsUserLocation={permission === Location.PermissionStatus.GRANTED}
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        mapPadding={{
          top: insets.top + space.sm,
          right: space.lg,
          bottom: 88 + bottomPad,
          left: space.lg,
        }}
      >
        <Polygon
          coordinates={DEMO_GROVE_POLYGON}
          strokeColor={colors.primary}
          strokeWidth={2}
          fillColor="rgba(63, 91, 58, 0.10)"
          lineDashPattern={[8, 6]}
          tappable={false}
        />
        {DEMO_ROOTS.map((root) => (
          <Marker
            key={root.id}
            coordinate={root.coordinate}
            title={root.title}
            description={root.heard ? "Root · heard" : "Root · walk here"}
            pinColor={root.heard ? colors.root : colors.accent}
            accessibilityLabel={`Root: ${root.title}, ${
              root.heard ? "heard" : "not yet heard"
            }`}
          />
        ))}
      </MapView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recenter map on your location"
        onPress={onRecenter}
        style={[
          styles.recenter,
          { top: insets.top + space.md } satisfies ViewStyle,
        ]}
      >
        <Text style={styles.recenterGlyph}>⌖</Text>
      </Pressable>

      <View style={[styles.chrome, { paddingBottom: bottomPad }]}>
        <View style={styles.chip} accessibilityRole="text">
          <Text style={styles.chipText}>{chipLabel}</Text>
        </View>

        <View style={styles.bar}>
          <BarLink href="/journal" label="Journal" />
          <BarLink href="/grow" label="Grow" />
          <BarLink href="/settings" label="Settings" />
        </View>
      </View>
    </View>
  );
}

function BarLink({
  href,
  label,
}: {
  href: "/journal" | "/grow" | "/settings";
  label: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.barBtn} accessibilityRole="button">
        <Text style={styles.barLabel}>{label}</Text>
      </Pressable>
    </Link>
  );
}

/** Cheap point-in-polygon for the demo rectangle-ish grove. */
function pointInDemoGrove(point: { latitude: number; longitude: number }) {
  const lats = DEMO_GROVE_POLYGON.map((p) => p.latitude);
  const lngs = DEMO_GROVE_POLYGON.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return (
    point.latitude >= minLat &&
    point.latitude <= maxLat &&
    point.longitude >= minLng &&
    point.longitude <= maxLng
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  recenter: {
    position: "absolute",
    right: space.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  recenterGlyph: {
    fontSize: 22,
    color: colors.text,
    lineHeight: 24,
  },
  chrome: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  chip: {
    alignSelf: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxWidth: "88%",
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: 10,
  },
  barBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    minHeight: 48,
  },
  barLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
});
