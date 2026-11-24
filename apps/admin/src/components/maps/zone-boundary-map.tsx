"use client";

/**
 * Terra Draw polygon editor for ambience/music zones.
 * When Maps API keys are missing (CI), renders nothing — GeoJSON textarea remains.
 */
import { useEffect, useId, useMemo, useRef } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from "terra-draw";
import { TerraDrawGoogleMapsAdapter } from "terra-draw-google-maps-adapter";
import { googleMapId, googleMapsApiKey, mapsEnabled } from "@/lib/maps/config";

type Polygon = {
  type: "Polygon";
  coordinates: number[][][];
};

function centerOf(poly: Polygon | null): { lat: number; lng: number } {
  const fallback = { lat: 41.1, lng: -111.9 };
  if (!poly) return fallback;
  let lat = 0;
  let lng = 0;
  let n = 0;
  for (const pair of poly.coordinates[0] ?? []) {
    const x = pair[0];
    const y = pair[1];
    if (x === undefined || y === undefined) continue;
    lng += x;
    lat += y;
    n += 1;
  }
  if (!n) return fallback;
  return { lat: lat / n, lng: lng / n };
}

function parsePolygon(raw: string): Polygon | null {
  try {
    const parsed = JSON.parse(raw) as Polygon;
    if (parsed.type !== "Polygon" || !Array.isArray(parsed.coordinates)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function DrawLayer({
  initialJson,
  onPolygon,
  disabled,
}: {
  initialJson: string;
  onPolygon: (geojson: string) => void;
  disabled?: boolean;
}) {
  const map = useMap();
  const drawRef = useRef<TerraDraw | null>(null);
  const onPolygonRef = useRef(onPolygon);
  onPolygonRef.current = onPolygon;

  useEffect(() => {
    if (!map || disabled || typeof google === "undefined") return;

    const div = map.getDiv();
    if (!div.id) div.id = `zone-terra-draw-${Math.random().toString(36).slice(2)}`;

    const draw = new TerraDraw({
      adapter: new TerraDrawGoogleMapsAdapter({
        map,
        lib: google.maps,
        coordinatePrecision: 7,
      }),
      modes: [
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: true,
                coordinates: {
                  midpoints: true,
                  draggable: true,
                  deletable: true,
                },
              },
            },
          },
        }),
        new TerraDrawPolygonMode({ editable: true }),
      ],
    });
    drawRef.current = draw;

    const syncFromStore = () => {
      const features = draw.getSnapshot();
      const poly = features.find((f) => f.geometry.type === "Polygon");
      if (!poly || poly.geometry.type !== "Polygon") return;
      onPolygonRef.current(
        JSON.stringify({
          type: "Polygon",
          coordinates: poly.geometry.coordinates,
        }),
      );
    };

    draw.on("ready", () => {
      const existing = parsePolygon(initialJson);
      if (existing) {
        draw.addFeatures([
          {
            type: "Feature",
            id: "existing-zone",
            properties: { mode: "polygon" },
            geometry: existing,
          },
        ]);
        draw.setMode("select");
      } else {
        draw.setMode("polygon");
      }
    });
    draw.on("finish", () => syncFromStore());
    draw.on("change", () => syncFromStore());
    draw.start();

    return () => {
      draw.stop();
      drawRef.current = null;
    };
    // initialJson only seeds once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount via key when zone changes
  }, [map, disabled]);

  return null;
}

export function ZoneBoundaryMap({
  boundaryJson,
  onBoundaryChange,
  disabled,
  className,
}: {
  boundaryJson: string;
  onBoundaryChange: (geojson: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const mapInstanceId = useId().replace(/:/g, "");
  const key = googleMapsApiKey();
  const mapId = googleMapId();
  const poly = useMemo(() => parsePolygon(boundaryJson), [boundaryJson]);
  const center = useMemo(() => centerOf(poly), [poly]);

  if (!mapsEnabled() || !key || !mapId) return null;

  return (
    <div className={className}>
      <p className="mb-2 text-xs text-textMuted">
        Draw or edit the zone polygon on the map. Double-click to finish a new
        polygon. GeoJSON below stays in sync.
      </p>
      <APIProvider apiKey={key}>
        <Map
          id={mapInstanceId}
          mapId={mapId}
          defaultCenter={center}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          className="h-72 w-full rounded-md border border-border"
          aria-label="Zone boundary map"
        >
          <DrawLayer
            initialJson={boundaryJson}
            onPolygon={onBoundaryChange}
            disabled={disabled}
          />
        </Map>
      </APIProvider>
    </div>
  );
}
