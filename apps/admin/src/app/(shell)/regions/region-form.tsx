"use client";

import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { saveRegion } from "./actions";

export function RegionForm({
  initial,
}: {
  initial?: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    lat: number;
    lng: number;
    boundsJson: string;
  };
}) {
  return (
    <ServerActionForm action={saveRegion} className="space-y-4">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <label className="block text-sm">
        <span className="text-textMuted">Name</span>
        <input
          name="name"
          required
          defaultValue={initial?.name}
          aria-label="Region name"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Slug</span>
        <input
          name="slug"
          required
          pattern="[a-z0-9-]+"
          defaultValue={initial?.slug}
          aria-label="Region slug"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Timezone</span>
        <input
          name="timezone"
          required
          defaultValue={initial?.timezone ?? "America/Denver"}
          aria-label="Timezone"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-textMuted">Sun lat</span>
          <input
            name="lat"
            type="number"
            step="any"
            required
            defaultValue={initial?.lat ?? 41.1}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-textMuted">Sun lng</span>
          <input
            name="lng"
            type="number"
            step="any"
            required
            defaultValue={initial?.lng ?? -111.9}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-textMuted">Bounds (GeoJSON Polygon, optional)</span>
        <textarea
          name="bounds"
          rows={6}
          defaultValue={initial?.boundsJson ?? ""}
          aria-label="Bounds GeoJSON"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          placeholder='{"type":"Polygon","coordinates":[[[...]]]}'
        />
      </label>
      <ServerActionSubmit>
        {initial ? "Save region" : "Create region"}
      </ServerActionSubmit>
    </ServerActionForm>
  );
}
