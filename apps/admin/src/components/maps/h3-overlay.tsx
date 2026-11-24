"use client";

/**
 * H3 cell overlay for landcover admin and the Simulator map.
 */
import { useEffect, useMemo } from "react";
import { cellToBoundary, gridDisk, latLngToCell } from "h3-js";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

export type H3Cell = { h3: string; code: string | number };

const CLASS_COLORS: Record<string, string> = {
  "11": "#4a90c8",
  "21": "#c4a574",
  "22": "#a08060",
  "90": "#2f6f4e",
  "95": "#3d8b6e",
};

function colorFor(code: string | number): string {
  return CLASS_COLORS[String(code)] ?? "#888888";
}

export function H3OverlayLayer({
  cells,
  opacity = 0.35,
}: {
  cells: readonly H3Cell[];
  opacity?: number;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");

  useEffect(() => {
    if (!map || !mapsLib || typeof google === "undefined" || cells.length === 0) {
      return;
    }
    const data = new google.maps.Data({ map });
    for (const cell of cells) {
      try {
        const boundary = cellToBoundary(cell.h3, true) as [number, number][];
        // h3 returns [lat,lng]; GeoJSON wants [lng,lat]
        const ring = boundary.map(([lat, lng]) => [lng, lat]);
        if (ring[0]) ring.push(ring[0]);
        data.addGeoJson({
          type: "Feature",
          properties: { code: String(cell.code) },
          geometry: { type: "Polygon", coordinates: [ring] },
        });
      } catch {
        /* bad index */
      }
    }
    data.setStyle((feat) => {
      const code = String(feat.getProperty("code") ?? "");
      return {
        fillColor: colorFor(code),
        fillOpacity: opacity,
        strokeColor: colorFor(code),
        strokeWeight: 1,
        clickable: false,
      };
    });
    return () => {
      data.setMap(null);
    };
  }, [map, mapsLib, cells, opacity]);

  return null;
}

/** Build a small H3 grid around a center for demo / preview overlays. */
export function demoH3CellsAround(
  center: { lat: number; lng: number },
  resolution: number,
  code = "90",
  ringSize = 1,
): H3Cell[] {
  const origin = latLngToCell(center.lat, center.lng, resolution);
  const disk = gridDisk(origin, ringSize);
  return disk.map((h3) => ({ h3, code }));
}

export function useDemoH3Cells(
  center: { lat: number; lng: number },
  resolution = 9,
): H3Cell[] {
  return useMemo(
    () => demoH3CellsAround(center, resolution),
    // center identity changes every parent render; lat/lng are the stable keys
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lat/lng
    [center.lat, center.lng, resolution],
  );
}
