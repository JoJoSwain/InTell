import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { groveShape } from "@intell/shared";
import { closeRing, haloBandPieces, type GrovePiece, type MapPoint } from "./groves";
import type { HomeCrossLink, HomeGrove, HomeLink, HomeMarker } from "./homeModel";
import { PULSE_FRAMES, markerImageName } from "./markerArt";
import { markerImages } from "./markerImages";
import { isOnScreen } from "./markers";
import { haloBandIndex } from "./pulseClock";
import { usePulseFrame } from "./usePulseFrame";
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
  crossLinks: HomeCrossLink[];
  showUser: boolean;
  reduceMotion: boolean;
  initialTarget: CameraTarget;
  onReady: (map: MapView) => void;
  onSelectMarker: (id: string) => void;
  onPressMap: () => void;
  onUserMoved: (away: boolean) => void;
  onUserLocation: (point: { latitude: number; longitude: number }) => void;
  user: { latitude: number; longitude: number } | null;
};

const WORLD: CameraTarget = { latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 80 };
const HALO_PT = 14;
const HALO_FRACTIONS = [0.25, 0.5, 0.75, 1] as const;

type DrawnLink = {
  id: string;
  coordinates: MapPoint[];
  color: string;
  weight: number;
  dash: [number, number];
};

export function HomeMap(props: Props) {
  const {
    theme: themeName,
    groves,
    markers,
    links,
    crossLinks,
    showUser,
    reduceMotion,
    initialTarget,
    onReady,
    onSelectMarker,
    onPressMap,
    onUserMoved,
    onUserLocation,
    user,
  } = props;
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(initialTarget);
  const markerPressed = useRef(false);
  const spiked = useRef(false);
  const lastUserEmit = useRef(0);
  const theme = tokens[themeName];

  const selectMarker = useCallback(
    (id: string) => {
      markerPressed.current = true;
      onSelectMarker(id);
    },
    [onSelectMarker],
  );

  const zoom = zoomFromLatitudeDelta(region.latitudeDelta);
  const meters = metersPerPoint(region.latitude, zoom);
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const outlineDash = useMemo(() => dashPattern([8, 5], meters, platform), [meters, platform]);
  const webDash = useMemo(() => dashPattern([4, 3], meters, platform), [meters, platform]);

  const outlineRings = useMemo(
    () =>
      groves.flatMap((grove) =>
        grove.pieces.flatMap((piece, index) =>
          [piece.outer, ...piece.holes].map((ring, ringIndex) => ({
            key: `${grove.id}-line-${index}-${ringIndex}`,
            coordinates: closeRing(ring),
          })),
        ),
      ),
    [groves],
  );

  const drawnLinks = useMemo(() => {
    const rows: DrawnLink[] = [];
    for (const link of links) {
      const trimmed = linkCoordinates(link.a, link.b, link.tierA, link.tierB, meters);
      if (!trimmed) continue;
      rows.push({
        id: link.id,
        coordinates: [
          { latitude: trimmed[0].lat, longitude: trimmed[0].lng },
          { latitude: trimmed[1].lat, longitude: trimmed[1].lng },
        ],
        color: withAlpha(theme.web, link.strength),
        weight: link.weight,
        dash: webDash,
      });
    }
    for (const link of crossLinks) {
      rows.push({
        id: link.id,
        coordinates: [
          { latitude: link.from.lat, longitude: link.from.lng },
          { latitude: link.tip.lat, longitude: link.tip.lng },
        ],
        color: withAlpha(theme.web, link.strength),
        weight: 1.5,
        dash: webDash,
      });
    }
    return rows;
  }, [crossLinks, links, meters, theme.web, webDash]);

  const chevrons = useMemo(() => {
    return crossLinks.map((link) => ({
      id: `${link.id}-chevron`,
      coordinates: chevronPoints(link.from, link.tip, 8 * meters),
      color: withAlpha(theme.web, link.strength),
    }));
  }, [crossLinks, meters, theme.web]);

  const haloBands = useMemo(() => {
    if (reduceMotion) return [] as { key: string; piece: GrovePiece; band: number }[];
    const rows: { key: string; piece: GrovePiece; band: number }[] = [];
    for (const grove of groves) {
      for (let band = 0; band < HALO_FRACTIONS.length; band += 1) {
        const fraction = HALO_FRACTIONS[band];
        if (fraction === undefined) continue;
        const extraM = HALO_PT * fraction * meters;
        const grown = groveShape(grove.shapeFragments, { extraM });
        if (!grown) continue;
        const pieces = haloBandPieces(grove.boundary, grown);
        for (let index = 0; index < pieces.length; index += 1) {
          const piece = pieces[index];
          if (!piece) continue;
          rows.push({ key: `${grove.id}-halo-${band}-${index}`, piece, band });
        }
      }
    }
    return rows;
  }, [groves, meters, reduceMotion]);

  useEffect(() => {
    if (!__DEV__ || reduceMotion || haloBands.length === 0) return;
    const started = performance.now();
    for (const grove of groves) {
      for (const fraction of HALO_FRACTIONS) {
        groveShape(grove.shapeFragments, { extraM: HALO_PT * fraction * meters });
      }
    }
    console.info(
      `halo-bands ms=${(performance.now() - started).toFixed(1)} bands=${haloBands.length} mPerPt=${meters.toFixed(3)}`,
    );
  }, [groves, haloBands.length, meters, reduceMotion]);

  const onScreenCount = useMemo(
    () => markers.filter((marker) => isOnScreen(marker.coordinate, region)).length,
    [markers, region],
  );

  useEffect(() => {
    if (!__DEV__ || spiked.current || reduceMotion) return;
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
        `marker-spike frames=${PULSE_FRAMES} tickAvgMs=${average.toFixed(1)} onScreen=${onScreenCount}`,
      );
      clearInterval(id);
    }, 1000 / PULSE_FRAMES);
    return () => clearInterval(id);
  }, [onScreenCount, reduceMotion]);

  return (
    <MapView
      ref={mapRef}
      key="home-map"
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      customMapStyle={themeName === "night" ? nightStyle : dayStyle}
      initialRegion={initialTarget ?? WORLD}
      showsUserLocation={showUser}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      showsCompass={false}
      zoomControlEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      onMapReady={() => {
        if (mapRef.current) onReady(mapRef.current);
      }}
      onUserLocationChange={(event) => {
        const coordinate = event.nativeEvent.coordinate;
        if (!coordinate) return;
        const now = Date.now();
        if (now - lastUserEmit.current < 500) return;
        lastUserEmit.current = now;
        onUserLocation({
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        });
      }}
      onRegionChangeComplete={(next) => {
        setRegion(next);
        if (!user) {
          onUserMoved(false);
          return;
        }
        const away =
          Math.abs(next.latitude - user.latitude) > next.latitudeDelta / 8 ||
          Math.abs(next.longitude - user.longitude) > next.longitudeDelta / 8;
        onUserMoved(away);
      }}
      onPress={() => {
        if (markerPressed.current) {
          markerPressed.current = false;
          return;
        }
        onPressMap();
      }}
    >
      {groves.flatMap((grove) =>
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
      {!reduceMotion ? (
        <HaloLayer
          bands={haloBands}
          color={themeName === "night" ? "#FFFFFF" : "#1B2A33"}
          baseAlpha={themeName === "night" ? 0.25 : 0.22}
        />
      ) : null}
      {drawnLinks.map((link) => (
        <Polyline
          key={link.id}
          coordinates={link.coordinates}
          strokeColor={link.color}
          strokeWidth={link.weight}
          lineDashPattern={link.dash}
          lineCap="butt"
          zIndex={1}
        />
      ))}
      {chevrons.map((chevron) => (
        <Polyline
          key={chevron.id}
          coordinates={chevron.coordinates}
          strokeColor={chevron.color}
          strokeWidth={1.5}
          lineCap="butt"
          lineJoin="miter"
          zIndex={1}
        />
      ))}
      {outlineRings.map((ring) => (
        <Polyline
          key={ring.key}
          coordinates={ring.coordinates}
          strokeColor={theme.outline}
          strokeWidth={2.25}
          lineDashPattern={outlineDash}
          lineCap="butt"
          lineJoin="miter"
          zIndex={2}
        />
      ))}
      {markers.map((marker) => (
        <Pin
          key={marker.id}
          marker={marker}
          theme={themeName}
          region={region}
          reduceMotion={reduceMotion}
          onSelect={selectMarker}
        />
      ))}
    </MapView>
  );
}

const HaloLayer = memo(function HaloLayer({
  bands,
  color,
  baseAlpha,
}: {
  bands: { key: string; piece: GrovePiece; band: number }[];
  color: string;
  baseAlpha: number;
}) {
  const frame = usePulseFrame(bands.length > 0);
  const active = haloBandIndex(frame);
  return (
    <>
      {bands.map((band) => {
        if (band.band !== active) return null;
        const fade = 1 - active / 3;
        return (
          <Polygon
            key={band.key}
            coordinates={band.piece.outer}
            holes={band.piece.holes}
            fillColor={withAlpha(color, baseAlpha * fade)}
            strokeWidth={0}
            strokeColor="transparent"
            tappable={false}
            zIndex={0}
          />
        );
      })}
    </>
  );
});

const Pin = memo(function Pin({
  marker,
  theme,
  region,
  reduceMotion,
  onSelect,
}: {
  marker: HomeMarker;
  theme: MapThemeName;
  region: Region;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
}) {
  const onScreen = isOnScreen(marker.coordinate, region);
  const pulsing = onScreen && !reduceMotion && marker.pulse !== "none";
  const frame = usePulseFrame(pulsing);
  const name = markerImageName(
    marker.tier,
    theme,
    pulsing ? marker.pulse : "none",
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
      onPress={() => onSelect(marker.id)}
      accessibilityLabel={marker.label}
      zIndex={3}
    />
  );
});

function chevronPoints(
  from: { lat: number; lng: number },
  tip: { lat: number; lng: number },
  widthM: number,
): MapPoint[] {
  const dx = tip.lng - from.lng;
  const dy = tip.lat - from.lat;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const metersLat = 111_320;
  const metersLng = 111_320 * Math.cos((tip.lat * Math.PI) / 180);
  const backLat = tip.lat - (uy * widthM) / metersLat;
  const backLng = tip.lng - (ux * widthM) / metersLng;
  const px = -uy;
  const py = ux;
  const half = widthM / 2;
  return [
    {
      latitude: backLat + (py * half) / metersLat,
      longitude: backLng + (px * half) / metersLng,
    },
    { latitude: tip.lat, longitude: tip.lng },
    {
      latitude: backLat - (py * half) / metersLat,
      longitude: backLng - (px * half) / metersLng,
    },
  ];
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("rgba")) {
    return color.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
  }
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  const value = color.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const fallbackCamera = WORLD;
