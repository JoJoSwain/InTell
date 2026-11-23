"use client";

import { GroveBoundaryMap } from "@/components/maps/grove-boundary-map";
import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { mapsEnabled } from "@/lib/maps/config";
import { saveGrove } from "./actions";

type RegionOption = { id: string; name: string };

export function GroveForm({
  regions,
  initial,
  canEdit,
  derivedShapeJson,
  farPieceWarning,
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
  };
  canEdit: boolean;
  derivedShapeJson?: string;
  farPieceWarning?: string | null;
}) {
  const showMap = mapsEnabled() && !!derivedShapeJson;

  if (!canEdit) {
    return (
      <p className="text-sm text-textMuted">View only for your role.</p>
    );
  }

  return (
    <ServerActionForm action={saveGrove} className="space-y-4">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
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

      {farPieceWarning ? (
        <p
          className="rounded-md border border-amber-600/40 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          {farPieceWarning}
        </p>
      ) : null}

      {showMap && derivedShapeJson ? (
        <div className="space-y-2">
          <p className="text-sm text-textMuted">
            Derived outline (union of fragment disks). Updates when you place or
            move fragments.
          </p>
          <GroveBoundaryMap shapeJson={derivedShapeJson} />
        </div>
      ) : (
        <p className="text-sm text-textMuted">
          {derivedShapeJson
            ? "Add a Google Maps key and Map ID to preview the derived outline."
            : "Place a fragment to see the derived grove outline."}
        </p>
      )}

      <ServerActionSubmit>
        {initial ? "Save grove" : "Create grove"}
      </ServerActionSubmit>
    </ServerActionForm>
  );
}
