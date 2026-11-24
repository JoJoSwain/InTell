"use client";

import { useEffect, useMemo } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { GROVE_BUFFER_M } from "@intell/shared";
import { googleMapId, googleMapsApiKey, mapsEnabled } from "@/lib/maps/config";
import { H3OverlayLayer, useDemoH3Cells } from "@/components/maps/h3-overlay";
import type { SimFragment } from "@/lib/simulate/harness";
import type { GeoJsonPolygon } from "@intell/shared";

function metersToLatDelta(m: number): number {
  return m / 111_320;
}
function metersToLngDelta(m: number, lat: number): number {
  return m / (111_320 * Math.cos((lat * Math.PI) / 180));
}

function CircleLayer({
  center,
  radiusM,
  stroke,
  fill,
}: {
  center: { lat: number; lng: number };
  radiusM: number;
  stroke: string;
  fill: string;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  useEffect(() => {
    if (!map || !mapsLib || typeof google === "undefined") return;
    const circle = new google.maps.Circle({
      map,
      center,
      radius: radiusM,
      strokeColor: stroke,
      strokeOpacity: 0.7,
      strokeWeight: 1,
      fillColor: fill,
      fillOpacity: 0.08,
      clickable: false,
    });
    return () => {
      circle.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lat/lng
  }, [map, mapsLib, center.lat, center.lng, radiusM, stroke, fill]);
  return null;
}

function PolygonLayer({
  polygon,
  stroke,
  fill,
}: {
  polygon: GeoJsonPolygon;
  stroke: string;
  fill: string;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  useEffect(() => {
    if (!map || !mapsLib || typeof google === "undefined") return;
    const data = new google.maps.Data({ map });
    data.addGeoJson({
      type: "Feature",
      properties: {},
      geometry: polygon,
    });
    data.setStyle({
      fillColor: fill,
      fillOpacity: 0.12,
      strokeColor: stroke,
      strokeWeight: 1,
      clickable: false,
    });
    return () => {
      data.setMap(null);
    };
  }, [map, mapsLib, polygon, stroke, fill]);
  return null;
}

export function SimulatorMap({
  walker,
  onWalkerChange,
  fragments,
  zones,
  showH3,
}: {
  walker: { lat: number; lng: number };
  onWalkerChange: (p: { lat: number; lng: number }) => void;
  fragments: SimFragment[];
  zones: { id: string; boundary: GeoJsonPolygon; kind: "ambience" | "music" }[];
  showH3: boolean;
}) {
  const key = googleMapsApiKey();
  const mapId = googleMapId();
  const h3Cells = useDemoH3Cells(walker, 9);
  const enabled = mapsEnabled();

  const fallback = useMemo(
    () => ({
      latMin: walker.lat - metersToLatDelta(200),
      latMax: walker.lat + metersToLatDelta(200),
      lngMin: walker.lng - metersToLngDelta(200, walker.lat),
      lngMax: walker.lng + metersToLngDelta(200, walker.lat),
    }),
    [walker.lat, walker.lng],
  );

  if (!enabled) {
    return (
      <div
        className="flex h-full min-h-[420px] flex-col gap-3 rounded-md border border-border bg-muted/30 p-4"
        aria-label="Simulator map fallback"
      >
        <p className="text-sm text-textMuted">
          Maps API keys not set — drag with lat/lng instead.
        </p>
        <label className="text-sm">
          Latitude
          <input
            type="number"
            step="0.00001"
            value={walker.lat}
            aria-label="Walker latitude"
            onChange={(e) =>
              onWalkerChange({ lat: Number(e.target.value), lng: walker.lng })
            }
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
          />
        </label>
        <label className="text-sm">
          Longitude
          <input
            type="number"
            step="0.00001"
            value={walker.lng}
            aria-label="Walker longitude"
            onChange={(e) =>
              onWalkerChange({ lat: walker.lat, lng: Number(e.target.value) })
            }
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
          />
        </label>
        <ul className="mt-2 space-y-1 text-xs text-textMuted">
          {fragments.map((f) => (
            <li key={f.id}>
              {f.title} ({f.tier}) · r={f.radiusM}m · {f.lat.toFixed(5)},{" "}
              {f.lng.toFixed(5)}
            </li>
          ))}
        </ul>
        <p className="font-mono text-[10px] text-textMuted">
          bounds {fallback.latMin.toFixed(5)}…{fallback.latMax.toFixed(5)} /{" "}
          {fallback.lngMin.toFixed(5)}…{fallback.lngMax.toFixed(5)}
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={key}>
      <Map
        className="h-full min-h-[420px] w-full rounded-md border border-border"
        defaultCenter={walker}
        defaultZoom={16}
        mapId={mapId}
        gestureHandling="greedy"
        disableDefaultUI={false}
        aria-label="Simulator map"
      >
        <AdvancedMarker
          position={walker}
          draggable
          title="Walker"
          onDragEnd={(e) => {
            const lat = e.latLng?.lat();
            const lng = e.latLng?.lng();
            if (lat != null && lng != null) onWalkerChange({ lat, lng });
          }}
        />
        {fragments.map((f) => (
          <CircleLayer
            key={`r-${f.id}`}
            center={{ lat: f.lat, lng: f.lng }}
            radiusM={f.radiusM}
            stroke="#2f6f4e"
            fill="#2f6f4e"
          />
        ))}
        {(["root", "branch", "leaf"] as const).map((tier) => {
          const f = fragments.find((x) => x.tier === tier);
          if (!f) return null;
          return (
            <CircleLayer
              key={`buf-${tier}`}
              center={{ lat: f.lat, lng: f.lng }}
              radiusM={GROVE_BUFFER_M[tier]}
              stroke="#8a6d3b"
              fill="#8a6d3b"
            />
          );
        })}
        {zones.map((z) => (
          <PolygonLayer
            key={z.id}
            polygon={z.boundary}
            stroke={z.kind === "music" ? "#5b4a8a" : "#2f6f4e"}
            fill={z.kind === "music" ? "#5b4a8a" : "#2f6f4e"}
          />
        ))}
        {showH3 ? <H3OverlayLayer cells={h3Cells} /> : null}
      </Map>
    </APIProvider>
  );
}
