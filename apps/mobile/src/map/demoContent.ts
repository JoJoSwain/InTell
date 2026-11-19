import type { LatLng, Region } from "react-native-maps";

/**
 * Placeholder Salt Marsh Grove — Farmington Bay WMA, Utah (demo locating).
 * Fixed lat/lng (not device location). Documented in docs/intell-home-map-notes.md.
 */
export const DEMO_GROVE = {
  id: "grove-salt-marsh-demo",
  name: "Salt Marsh",
  /** Approximate center of Farmington Bay Waterfowl Management Area */
  center: { latitude: 40.9897, longitude: -111.9083 },
} as const;

/** Rough polygon around the demo Salt Marsh Grove (PRODUCT §4). */
export const DEMO_GROVE_POLYGON: LatLng[] = [
  { latitude: 40.9975, longitude: -111.9205 },
  { latitude: 40.9978, longitude: -111.8960 },
  { latitude: 40.9815, longitude: -111.8945 },
  { latitude: 40.9808, longitude: -111.9190 },
];

export type DemoRoot = {
  id: string;
  title: string;
  coordinate: LatLng;
  heard: boolean;
};

/** Root markers only for this home-map milestone (Branches/Leaves later). */
export const DEMO_ROOTS: DemoRoot[] = [
  {
    id: "root-marsh-edge",
    title: "Marsh Edge",
    coordinate: { latitude: 40.9922, longitude: -111.9115 },
    heard: false,
  },
  {
    id: "root-causeway",
    title: "Causeway Light",
    coordinate: { latitude: 40.9864, longitude: -111.9048 },
    heard: true,
  },
];

export const DEMO_INITIAL_REGION: Region = {
  latitude: DEMO_GROVE.center.latitude,
  longitude: DEMO_GROVE.center.longitude,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

/**
 * Muted Google Maps style — paper land, quiet roads, no POI icons (DESIGN §1.2).
 * Full custom tile branding remains a later polish; this keeps eyes on the place.
 */
export const MUTED_GOOGLE_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#F6F2EA" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5B6152" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F6F2EA" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#E8E2D4" }],
  },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#DDD6C7" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#3D6E7A" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#86B3BE" }],
  },
];
