"use client";

import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { ZoneBoundaryField } from "@/components/sound/zone-boundary-field";
import { saveAmbienceZone, saveMusicZone } from "../actions";

export function ZoneEditor({
  kind,
  zoneId,
  name,
  priority,
  edgeFadeM,
  boundaryJson,
  meta,
  editable,
}: {
  kind: "ambience" | "music";
  zoneId: string;
  name: string;
  priority: number;
  edgeFadeM: number;
  boundaryJson: string;
  meta: string;
  editable: boolean;
}) {
  const action = kind === "ambience" ? saveAmbienceZone : saveMusicZone;
  if (!editable) {
    return (
      <div className="rounded-md border border-border p-4">
        <h3 className="font-medium">{name}</h3>
        <p className="text-sm text-textMuted">
          {meta} · priority {priority} · edge fade {edgeFadeM} m
        </p>
      </div>
    );
  }

  return (
    <ServerActionForm action={action} className="max-w-xl space-y-4 rounded-md border border-border p-4">
      <input type="hidden" name="id" value={zoneId} />
      <div>
        <h3 className="font-medium">{kind} zone</h3>
        <p className="text-sm text-textMuted">{meta}</p>
      </div>
      <label className="block text-sm">
        <span className="text-textMuted">Name</span>
        <input
          name="name"
          required
          defaultValue={name}
          aria-label="Zone name"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-textMuted">Priority</span>
          <input
            name="priority"
            type="number"
            defaultValue={String(priority)}
            aria-label="Zone priority"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-textMuted">Edge fade (m)</span>
          <input
            name="edge_fade_m"
            type="number"
            step="0.01"
            defaultValue={String(edgeFadeM)}
            aria-label="Edge fade metres"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
      </div>
      <ZoneBoundaryField defaultValue={boundaryJson} />
      <ServerActionSubmit aria-label={`Save ${name}`}>Save</ServerActionSubmit>
    </ServerActionForm>
  );
}