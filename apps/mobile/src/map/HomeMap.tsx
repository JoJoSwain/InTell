import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { closeRing } from "./groves";
import type { HomeGrove, HomeLink, HomeMarker } from "./homeModel";
import { PULSE_FRAMES, markerImageName } from "./markerArt";
import { markerImages } from "./markerImages";
import { isOnScreen } from "./markers";
import { dashPattern, linkCoordinates, metersPerPoint, zoomFromLatitudeDelta } from "./web";
import dayStyle from "./styles/day.json";
import nightStyle from "./styles/night.json";
import { tokens, type MapThemeName } from "../ui/tokens";

type CameraTarget = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

type Props = {
  theme: MapThemeName;
  groves: HomeGrove[];
  markers: HomeMarker[];
  links: HomeLink[];
  showUser: boolean;
  reduceMotion: boolean;
  initialTarget: CameraTarget;
  onReady: (map: MapView) => void;
  onSelectMarker: (id: string) => void;
  onPressMap: () => void;
  onUserMoved: (away: boolean) => void;
  user: { latitude: number; longitude: number } | null;
};

const WORLD: CameraTarget = { latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 80 };

export function HomeMap(props: Props) {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(props.initialTarget);
  const [tick, setTick] = useState(0);
  const markerPressed = useRef(false);
  const spiked = useRef(false);
  const frame = props.reduceMotion ? 0 : tick;

  useEffect(() => {
    if (props.reduceMotion) return;
    const id = setInterval(() => {
      setTick(Math.floor((Date.now() % 1000) / (1000 / PULSE_FRAMES)));
    }, 1000 / PULSE_FRAMES);
    return () => clearInterval(id);
  }, [props.reduceMotion]);

  const onScreen = useMemo(
    () => props.markers.filter((marker) => isOnScreen(marker.coordinate, region)).length,
    [props.markers, region],
  );

  useEffect(() => {
    if (!__DEV__ || spiked.current || props.reduceMotion) return;
    const samples: number[] = [];
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      samples.push(now - last);
      last = now;
      if (samples.length < 16) return;
      spiked.current = true;
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      console.info(
        `marker-spike frames=${PULSE_FRAMES} tickAvgMs=${average.toFixed(1)} onScreen=${onScreen}`,
      );
      clearInterval(id);
    }, 1000 / PULSE_FRAMES);
    return () => clearInterval(id);
  }, [onScreen, props.reduceMotion]);

  const zoom = zoomFromLatitudeDelta(region.latitudeDelta);
  const meters = metersPerPoint(region.latitude, zoom);
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const outlineDash = dashPattern([8, 5], meters, platform);
  const webDash = dashPattern([4, 3], meters, platform);
  const theme = tokens[props.theme];

  return (
    <MapView
      ref={mapRef}
      key="home-map"
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      customMapStyle={props.theme === "night" ? nightStyle : dayStyle}
      initialRegion={props.initialTarget ?? WORLD}
      showsUserLocation={props.showUser}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      showsCompass={false}
      zoomControlEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      onMapReady={() => {
        if (mapRef.current) props.onReady(mapRef.current);
      }}
      onRegionChangeComplete={(next) => {
        setRegion(next);
        if (!props.user) {
          props.onUserMoved(false);
          return;
        }
        const away =
          Math.abs(next.latitude - props.user.latitude) > next.latitudeDelta / 8 ||
          Math.abs(next.longitude - props.user.longitude) > next.longitudeDelta / 8;
        props.onUserMoved(away);
      }}
      onPress={() => {
        if (markerPressed.current) {
          markerPressed.current = false;
          return;
        }
        props.onPressMap();
      }}
    >
      {props.groves.flatMap((grove) =>
        grove.pieces.map((piece, index) => (
          <Polygon
            key={`${grove.id}-fill-${index}`}
            coordinates={piece.outer}
            holes={piece.holes}
            fillColor={theme.groveFill}
            strokeWidth={0}
            strokeColor={theme.groveFill}
            tappable={false}
          />
        )),
      )}
      {props.links.map((link) => {
        const trimmed = linkCoordinates(link.a, link.b, link.tierA, link.tierB, meters);
        if (!trimmed) return null;
        return (
          <Polyline
            key={link.id}
            coordinates={[
              { latitude: trimmed[0].lat, longitude: trimmed[0].lng },
              { latitude: trimmed[1].lat, longitude: trimmed[1].lng },
            ]}
            strokeColor={withAlpha(theme.web, link.strength)}
            strokeWidth={link.weight}
            lineDashPattern={webDash}
            lineCap="butt"
            zIndex={1}
          />
        );
      })}
      {props.groves.flatMap((grove) =>
        grove.pieces.flatMap((piece, index) =>
          [piece.outer, ...piece.holes].map((ring, ringIndex) => (
            <Polyline
              key={`${grove.id}-line-${index}-${ringIndex}`}
              coordinates={closeRing(ring)}
              strokeColor={theme.outline}
              strokeWidth={2.25}
              lineDashPattern={outlineDash}
              lineCap="butt"
              lineJoin="miter"
              zIndex={2}
            />
          )),
        ),
      )}
      {props.markers.map((marker) => (
        <Pin
          key={marker.id}
          marker={marker}
          theme={props.theme}
          frame={frame}
          region={region}
          reduceMotion={props.reduceMotion}
          onPress={() => {
            markerPressed.current = true;
            props.onSelectMarker(marker.id);
          }}
        />
      ))}
    </MapView>
  );
}

const Pin = memo(function Pin({
  marker,
  theme,
  frame,
  region,
  reduceMotion,
  onPress,
}: {
  marker: HomeMarker;
  theme: MapThemeName;
  frame: number;
  region: Region;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const onScreen = isOnScreen(marker.coordinate, region);
  const name = markerImageName(
    marker.tier,
    theme,
    onScreen ? marker.pulse : "none",
    frame,
    reduceMotion || !onScreen,
  );
  const image = markerImages[name];
  if (!image) return null;
  return (
    <Marker
      coordinate={marker.coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      image={image}
      opacity={marker.locked ? 0.35 : 1}
      tracksViewChanges={false}
      onPress={onPress}
      accessibilityLabel={marker.label}
      zIndex={3}
    />
  );
});

function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const fallbackCamera = WORLD;
