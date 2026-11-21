"use client";

/**
 * Terra Draw Google Maps adapter requirements (M3c answer 16):
 * - Constructor needs `{ lib: typeof google.maps, map: google.maps.Map }`.
 * - Peer `@googlemaps/js-api-loader` is satisfied transitively by
 *   `@vis.gl/react-google-maps` (do not add a direct dep).
 * - Rendering uses Advanced Markers / Data overlays; Google requires a
 *   Map ID for vector maps — we only mount when mapsEnabled() (key + Map ID).
 * - Pass the live `google.maps` namespace as `lib` after APIProvider loads.
 */
import { useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { TerraDraw, TerraDrawPolygonMode } from "terra-draw";
import { TerraDrawGoogleMapsAdapter } from "terra-draw-google-maps-adapter";
import { googleMapId, googleMapsApiKey } from "@/lib/maps/config";

function DrawLayer({
  initialGeoJson,
  onChange,
}: {
  initialGeoJson: string;
  onChange: (geoJson: string) => void;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const drawRef = useRef<TerraDraw | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!map || !mapsLib || typeof google === "undefined") return;

    const adapter = new TerraDrawGoogleMapsAdapter({
      map,
      lib: google.maps,
      coordinatePrecision: 6,
    });
    const draw = new TerraDraw({
      adapter,
      modes: [new TerraDrawPolygonMode()],
    });
    draw.start();
    draw.setMode("polygon");

    try {
      if (initialGeoJson.trim()) {
        const parsed = JSON.parse(initialGeoJson) as {
          type?: string;
          coordinates?: unknown;
        };
        if (parsed.type === "Polygon") {
          draw.addFeatures([
            {
              type: "Feature",
              properties: { mode: "polygon" },
              geometry: {
                type: "Polygon",
                coordinates: parsed.coordinates as number[][][],
              },
            },
          ]);
        }
      }
    } catch {
      // ignore bad initial geo
    }

    const sync = () => {
      const features = draw.getSnapshot();
      const poly = features.find((f) => f.geometry.type === "Polygon");
      if (poly && poly.geometry.type === "Polygon") {
        onChangeRef.current(
          JSON.stringify({
            type: "Polygon",
            coordinates: poly.geometry.coordinates,
          }),
        );
      }
    };
    draw.on("finish", sync);
    draw.on("change", sync);
    drawRef.current = draw;

    return () => {
      draw.stop();
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per map
  }, [map, mapsLib]);

  return null;
}

export function GroveBoundaryMap({
  initialGeoJson,
  onChange,
  className,
}: {
  initialGeoJson: string;
  onChange: (geoJson: string) => void;
  className?: string;
}) {
  const key = googleMapsApiKey();
  const mapId = googleMapId();
  if (!key || !mapId) return null;

  let center = { lat: 41.1, lng: -111.9 };
  try {
    const g = JSON.parse(initialGeoJson) as {
      coordinates?: number[][][];
    };
    const ring = g.coordinates?.[0];
    if (ring && ring.length > 0) {
      const lngs = ring.map((c) => c[0] ?? 0);
      const lats = ring.map((c) => c[1] ?? 0);
      center = {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      };
    }
  } catch {
    // default center
  }

  return (
    <div
      className={className}
      style={{ height: 320 }}
      role="region"
      aria-label="Grove boundary map"
    >
      <APIProvider apiKey={key}>
        <Map
          defaultCenter={center}
          defaultZoom={14}
          mapId={mapId}
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: "100%", height: "100%" }}
        >
          <DrawLayer initialGeoJson={initialGeoJson} onChange={onChange} />
        </Map>
      </APIProvider>
    </div>
  );
}
