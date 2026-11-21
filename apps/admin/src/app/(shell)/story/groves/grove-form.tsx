"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GroveBoundaryMap } from "@/components/maps/grove-boundary-map";
import { mapsEnabled } from "@/lib/maps/config";
import { saveGrove } from "./actions";

type RegionOption = { id: string; name: string };

export function GroveForm({
  regions,
  initial,
  canEdit,
}: {
  regions: RegionOption[];
  initial?: {
    id: string;
    region_id: string;
    name_en: string;
    premise_en: string;
    slug: string;
    website_url: string;
    gatherings_url: string;
    allows_speaker_wildlife_sounds: boolean;
    boundaryJson: string;
  };
  canEdit: boolean;
}) {
  const [boundary, setBoundary] = useState(initial?.boundaryJson ?? "");
  const showMap = mapsEnabled();

  if (!canEdit) {
    return (
      <p className="text-sm text-textMuted">View only for your role.</p>
    );
  }

  return (
    <form action={saveGrove} className="space-y-4">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      {initial ? (
        <input
          type="hidden"
          name="original_boundary"
          value={initial.boundaryJson}
        />
      ) : null}
      <input type="hidden" name="boundary" value={boundary} />
      <label className="block text-sm">
        <span className="text-textMuted">Region</span>
        <select
          name="region_id"
          required
          defaultValue={initial?.region_id ?? regions[0]?.id}
          aria-label="Region"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        >
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Name (en)</span>
        <input
          name="name_en"
          required
          defaultValue={initial?.name_en}
          aria-label="Grove name"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Slug</span>
        <input
          name="slug"
          defaultValue={initial?.slug}
          aria-label="Slug"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Premise (en)</span>
        <textarea
          name="premise_en"
          rows={3}
          defaultValue={initial?.premise_en}
          aria-label="Premise"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Website URL</span>
        <input
          name="website_url"
          type="url"
          defaultValue={initial?.website_url}
          aria-label="Website URL"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Gatherings URL</span>
        <input
          name="gatherings_url"
          type="url"
          defaultValue={initial?.gatherings_url}
          aria-label="Gatherings URL"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allows_speaker_wildlife_sounds"
          defaultChecked={initial?.allows_speaker_wildlife_sounds}
          aria-label="Allows speaker wildlife sounds"
        />
        <span>Allows speaker wildlife sounds</span>
      </label>

      <label className="block text-sm">
        <span className="text-textMuted">Boundary (GeoJSON Polygon)</span>
        <textarea
          rows={6}
          value={boundary}
          onChange={(e) => setBoundary(e.target.value)}
          aria-label="Boundary GeoJSON"
          required
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          placeholder='{"type":"Polygon","coordinates":[[[lng,lat],...]]}'
        />
      </label>

      {showMap ? (
        <GroveBoundaryMap
          initialGeoJson={boundary}
          onChange={setBoundary}
          className="overflow-hidden rounded-md border border-border"
        />
      ) : (
        <p className="text-sm text-textMuted">
          Map disabled (set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and
          NEXT_PUBLIC_GOOGLE_MAP_ID). Use the GeoJSON field above.
        </p>
      )}

      <Button type="submit">{initial ? "Save grove" : "Create grove"}</Button>
    </form>
  );
}
