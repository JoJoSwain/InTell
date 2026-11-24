"use client";

import { useState } from "react";
import { ZoneBoundaryMap } from "@/components/maps/zone-boundary-map";

type Props = {
  name?: string;
  defaultValue: string;
  disabled?: boolean;
};

export function ZoneBoundaryField({
  name = "boundary",
  defaultValue,
  disabled,
}: Props) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="space-y-3">
      <ZoneBoundaryMap
        boundaryJson={defaultValue}
        onBoundaryChange={setValue}
        disabled={disabled}
      />
      <label className="block text-sm">
        <span className="text-textMuted">Boundary (GeoJSON Polygon)</span>
        <textarea
          name={name}
          rows={8}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          aria-label="Zone boundary GeoJSON"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          placeholder='{"type":"Polygon","coordinates":[[[lng,lat],...]]}'
        />
        <span className="mt-1 block text-xs text-textMuted">
          Paste a GeoJSON Polygon, or draw on the map when Google Maps is
          configured. Leave blank to keep the current boundary.
        </span>
      </label>
    </div>
  );
}
