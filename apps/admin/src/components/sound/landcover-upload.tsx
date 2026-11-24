"use client";

import { useMemo, useState, useTransition } from "react";
import { cellToBoundary, latLngToCell } from "h3-js";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { sha256Hex } from "@/lib/media/upload";
import { registerLandcoverGrid } from "@/app/(shell)/sound/actions";
import {
  APIProvider,
  Map,
} from "@vis.gl/react-google-maps";
import { H3OverlayLayer, type H3Cell } from "@/components/maps/h3-overlay";
import { googleMapId, googleMapsApiKey, mapsEnabled } from "@/lib/maps/config";

type RegionOpt = { id: string; name: string; slug: string };

/**
 * Landcover grid JSON upload + H3 preview overlay.
 * Expected JSON: { h3Resolution, center?: {lat,lng}, cells: Record<h3, code> | {h3, code}[] }
 */
export function LandcoverUpload({
  regions,
  defaultRegionId,
}: {
  regions: RegionOpt[];
  defaultRegionId?: string;
}) {
  const [regionId, setRegionId] = useState(defaultRegionId ?? regions[0]?.id ?? "");
  const [source, setSource] = useState("NLCD upload");
  const [status, setStatus] = useState<string | null>(null);
  const [cells, setCells] = useState<H3Cell[]>([]);
  const [resolution, setResolution] = useState(9);
  const [center, setCenter] = useState({ lat: 40.96122, lng: -111.92896 });
  const [pending, startTransition] = useTransition();

  const enabled = mapsEnabled();
  const key = googleMapsApiKey();
  const mapId = googleMapId();

  const region = useMemo(
    () => regions.find((r) => r.id === regionId),
    [regions, regionId],
  );

  async function onFile(file: File) {
    setStatus(null);
    const text = await file.text();
    let parsed: {
      h3Resolution?: number;
      center?: { lat: number; lng: number };
      cells?: Record<string, string | number> | { h3: string; code: string | number }[];
    };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      setStatus("File must be JSON");
      return;
    }
    const res = parsed.h3Resolution ?? 9;
    setResolution(res);
    if (parsed.center) setCenter(parsed.center);

    let nextCells: H3Cell[] = [];
    if (Array.isArray(parsed.cells)) {
      nextCells = parsed.cells.map((c) => ({ h3: c.h3, code: c.code }));
    } else if (parsed.cells && typeof parsed.cells === "object") {
      nextCells = Object.entries(parsed.cells).map(([h3, code]) => ({ h3, code }));
    } else {
      // Synthesize a disk around center for preview when cells omitted
      const origin = latLngToCell(center.lat, center.lng, res);
      nextCells = [{ h3: origin, code: "90" }];
    }
    setCells(nextCells);

    const bytes = new TextEncoder().encode(text);
    const sha = await sha256Hex(bytes.buffer.slice(0));
    const supabase = createClient();
    const objectPath = `landcover/${region?.slug ?? regionId}/${sha}.json`;
    const { error: upErr } = await supabase.storage
      .from("staging-audio")
      .upload(objectPath, bytes, {
        upsert: true,
        contentType: "application/json",
      });
    if (upErr) {
      setStatus(upErr.message);
      return;
    }

    const form = new FormData();
    form.set("region_id", regionId);
    form.set("h3_resolution", String(res));
    form.set("source", source);
    form.set("file_path", `staging-audio/${objectPath}`);
    form.set("sha", sha);
    form.set("cell_count", String(nextCells.length));

    startTransition(async () => {
      const result = await registerLandcoverGrid(form);
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      setStatus(
        `Registered grid (${nextCells.length} cells, H3 r${res}). Path staging-audio/${objectPath}`,
      );
    });
  }

  return (
    <section className="mt-10 space-y-4" aria-labelledby="upload-heading">
      <h2 id="upload-heading" className="font-serif text-xl font-semibold">
        Upload grid
      </h2>
      <p className="text-sm text-textMuted">
        Upload a JSON H3 → NLCD class map. Preview draws the H3 overlay; the file
        is stored under <code className="text-xs">staging-audio/landcover/</code>.
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Region
          <select
            value={regionId}
            aria-label="Landcover region"
            onChange={(e) => setRegionId(e.target.value)}
            className="mt-1 block rounded-md border border-input bg-background px-3 py-2"
          >
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Source label
          <input
            value={source}
            aria-label="Landcover source"
            onChange={(e) => setSource(e.target.value)}
            className="mt-1 block rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Grid JSON
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Landcover grid file"
            disabled={pending || !regionId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
            className="mt-1 block text-sm"
          />
        </label>
      </div>
      {status ? (
        <p className="text-sm text-textMuted" role="status">
          {status}
        </p>
      ) : null}

      {enabled && cells.length > 0 ? (
        <div className="h-80 overflow-hidden rounded-md border border-border">
          <APIProvider apiKey={key}>
            <Map
              className="h-full w-full"
              defaultCenter={center}
              defaultZoom={13}
              mapId={mapId}
              gestureHandling="greedy"
              aria-label="Landcover H3 overlay"
            >
              <H3OverlayLayer cells={cells} />
            </Map>
          </APIProvider>
        </div>
      ) : cells.length > 0 ? (
        <div className="rounded-md border border-border p-3 text-sm text-textMuted">
          <p>
            H3 preview (r{resolution}): {cells.length} cells. Maps keys not set —
            listing first indexes:
          </p>
          <ul className="mt-2 font-mono text-xs">
            {cells.slice(0, 8).map((c) => (
              <li key={c.h3}>
                {c.h3} → {c.code}
              </li>
            ))}
          </ul>
          {/* Keep cellToBoundary referenced for typecheck when maps off */}
          <span className="sr-only">
            {cells[0] ? cellToBoundary(cells[0].h3).length : 0}
          </span>
        </div>
      ) : null}

      <Button type="button" variant="outline" size="sm" disabled>
        tools/landcover builds binary NLCD grids (staff CLI)
      </Button>
    </section>
  );
}
