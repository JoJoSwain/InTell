"use client";

/**
 * Read-only derived grove outline (ADR 0006). Terra Draw stays on ambience
 * and music zone maps; this surface only draws groveShape MultiPolygons.
 */
import { useEffect, useMemo } from "react";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { googleMapId, googleMapsApiKey } from "@/lib/maps/config";

type MultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

function OutlineLayer({ shape }: { shape: MultiPolygon | null }) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");

  useEffect(() => {
    if (!map || !mapsLib || typeof google === "undefined" || !shape) return;
    const data = new google.maps.Data({ map });
    data.addGeoJson({
      type: "Feature",
      properties: {},
      geometry: shape,
    });
    data.setStyle({
      fillColor: "#2f6f4e",
      fillOpacity: 0.12,
      strokeColor: "#2f6f4e",
      strokeWeight: 2,
      clickable: false,
    });
    return () => {
      data.setMap(null);
    };
  }, [map, mapsLib, shape]);

  return null;
}

function centerOf(shape: MultiPolygon | null): { lat: number; lng: number } {
  const fallback = { lat: 41.1, lng: -111.9 };
  if (!shape) return fallback;
  let lat = 0;
  let lng = 0;
  let n = 0;
  for (const piece of shape.coordinates) {
    for (const pair of piece[0] ?? []) {
      const x = pair[0];
      const y = pair[1];
      if (x === undefined || y === undefined) continue;
      lng += x;
      lat += y;
      n += 1;
    }
  }
  if (!n) return fallback;
  return { lat: lat / n, lng: lng / n };
}

export function GroveBoundaryMap({
  shapeJson,
  className,
}: {
  shapeJson: string;
  className?: string;
}) {
  const key = googleMapsApiKey();
  const mapId = googleMapId();
  const shape = useMemo(() => {
    try {
      const parsed = JSON.parse(shapeJson) as MultiPolygon;
      if (parsed.type !== "MultiPolygon") return null;
      return parsed;
    } catch {
      return null;
    }
  }, [shapeJson]);
  const center = useMemo(() => centerOf(shape), [shape]);

  if (!key || !mapId) return null;

  return (
    <div className={className}>
      <APIProvider apiKey={key}>
        <Map
          mapId={mapId}
          defaultCenter={center}
          defaultZoom={15}
          gestureHandling="greedy"
          disableDefaultUI
          className="h-72 w-full rounded-md border border-border"
          aria-label="Derived grove boundary map"
        >
          <OutlineLayer shape={shape} />
        </Map>
      </APIProvider>
    </div>
  );
}
