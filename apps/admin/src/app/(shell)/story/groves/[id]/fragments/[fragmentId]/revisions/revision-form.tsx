"use client";

import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { BreathPointsField } from "@/components/sound/breath-points-field";
import { createRevision, updateRevision } from "./actions";

export type AudioOption = {
  id: string;
  title: string;
  kind: string;
  staging_path?: string | null;
};

export type VersionInitial = {
  id?: string;
  narration_asset_id: string;
  transcript: string;
  vtt: string;
  other_time_hint?: string;
  breath_points_ms?: number[];
  swell_cues_ms?: number[];
};

export type RevisionFormInitial = {
  id?: string;
  revision_no?: number;
  change_kind?: "contingency" | "correction" | "";
  change_note?: string;
  change_teaser?: string;
  status?: string;
  day?: VersionInitial | null;
  night?: VersionInitial | null;
};

function VersionFields({
  window,
  assets,
  initial,
  readOnly,
  stagingByAssetId,
}: {
  window: "day" | "night";
  assets: AudioOption[];
  initial?: VersionInitial | null;
  readOnly: boolean;
  stagingByAssetId: Record<string, string>;
}) {
  const label = window === "day" ? "Day" : "Night";
  const included = Boolean(initial);
  return (
    <fieldset className="space-y-3 rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-medium">{label} version</legend>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name={`include_${window}`}
          defaultChecked={included}
          disabled={readOnly}
          aria-label={`Include ${label} version`}
        />
        Include {label}
      </label>
      {initial?.id ? (
        <input type="hidden" name={`${window}_version_id`} value={initial.id} />
      ) : null}
      <label className="block text-sm">
        <span className="text-textMuted">Narration asset</span>
        <select
          name={`${window}_narration_asset_id`}
          defaultValue={initial?.narration_asset_id ?? ""}
          disabled={readOnly}
          aria-label={`${label} narration asset`}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="">Select audio…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
              {a.kind !== "narration" ? ` (${a.kind})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Transcript (staff-typed)</span>
        <textarea
          name={`${window}_transcript`}
          rows={6}
          defaultValue={initial?.transcript ?? ""}
          disabled={readOnly}
          aria-label={`${label} transcript`}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">VTT (optional)</span>
        <textarea
          name={`${window}_vtt`}
          rows={3}
          defaultValue={initial?.vtt ?? ""}
          disabled={readOnly}
          aria-label={`${label} VTT`}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Other-time hint (en)</span>
        <textarea
          name={`${window}_other_time_hint`}
          rows={2}
          defaultValue={initial?.other_time_hint ?? ""}
          disabled={readOnly}
          aria-label={`${label} other-time hint`}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
        <span className="mt-1 block text-xs text-textMuted">
          Required when this revision has both Day and Night. Example: &quot;After
          dusk, River speaks of something else.&quot;
        </span>
      </label>
      <BreathPointsField
        name={`${window}_breath_points_ms`}
        label={`${label} breath points (ms, comma-separated)`}
        defaultValue={initial?.breath_points_ms ?? []}
        disabled={readOnly}
        stagingPath={
          initial?.narration_asset_id
            ? stagingByAssetId[initial.narration_asset_id]
            : null
        }
      />
      <BreathPointsField
        name={`${window}_swell_cues_ms`}
        label={`${label} swell cues (ms, comma-separated)`}
        defaultValue={initial?.swell_cues_ms ?? []}
        disabled={readOnly}
      />
    </fieldset>
  );
}

export function RevisionForm({
  groveId,
  fragmentId,
  isFirst,
  canWrite,
  audioAssets,
  initial,
}: {
  groveId: string;
  fragmentId: string;
  isFirst: boolean;
  canWrite: boolean;
  audioAssets: AudioOption[];
  initial?: RevisionFormInitial;
}) {
  const readOnly =
    !canWrite || (initial?.status != null && initial.status !== "draft");
  const action = initial?.id ? updateRevision : createRevision;
  const changeKind = isFirst
    ? "contingency"
    : (initial?.change_kind ?? "");
  // Remount when server-provided field values change after save (R1 / save-twice).
  const remountKey = initial?.id
    ? `rev:${initial.id}:${initial.change_teaser ?? ""}:${initial.day?.other_time_hint ?? ""}:${initial.night?.other_time_hint ?? ""}:${(initial.day?.breath_points_ms ?? []).join(",")}`
    : `rev:new:${fragmentId}`;
  const stagingByAssetId: Record<string, string> = {};
  for (const a of audioAssets) {
    if (a.staging_path) stagingByAssetId[a.id] = a.staging_path;
  }

  return (
    <ServerActionForm
      formKey={remountKey}
      action={action}
      className="space-y-6"
    >
      <input type="hidden" name="grove_id" value={groveId} />
      <input type="hidden" name="fragment_id" value={fragmentId} />
      {initial?.id ? (
        <input type="hidden" name="revision_id" value={initial.id} />
      ) : null}
      <input type="hidden" name="is_first" value={isFirst ? "1" : "0"} />

      <div className="space-y-2">
        <p className="text-sm font-medium">Change kind</p>
        {isFirst ? (
          <>
            <input type="hidden" name="change_kind" value="contingency" />
            <p
              className="inline-flex items-center rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
              aria-label="Story Contingency"
            >
              Story Contingency
            </p>
            <p className="text-sm text-textMuted">
              The first revision of a fragment is always a Story Contingency.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Change kind">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="change_kind"
                value="contingency"
                required
                defaultChecked={changeKind === "contingency"}
                disabled={readOnly}
                aria-label="Story Contingency"
              />
              Story Contingency
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="change_kind"
                value="correction"
                required
                defaultChecked={changeKind === "correction"}
                disabled={readOnly}
                aria-label="Story Correction"
              />
              Story Correction
            </label>
          </div>
        )}
      </div>

      <label className="block text-sm">
        <span className="text-textMuted">Change note (internal)</span>
        <textarea
          name="change_note"
          rows={2}
          defaultValue={initial?.change_note ?? ""}
          disabled={readOnly}
          aria-label="Change note"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>

      {!isFirst ? (
        <label className="block text-sm">
          <span className="text-textMuted">Change teaser (en)</span>
          <textarea
            name="change_teaser_en"
            rows={2}
            defaultValue={initial?.change_teaser ?? ""}
            disabled={readOnly}
            aria-label="Change teaser"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
          />
          <span className="mt-1 block text-xs text-textMuted">
            Shown to listeners when they tap a fragment whose story has changed.
            Required for Story Contingency after revision 1.
          </span>
        </label>
      ) : null}

      <p className="text-xs text-textMuted">
        Language is always English (en). No AI generation.
      </p>

      <VersionFields
        window="day"
        assets={audioAssets}
        initial={initial?.day}
        readOnly={readOnly}
        stagingByAssetId={stagingByAssetId}
      />
      <VersionFields
        window="night"
        assets={audioAssets}
        initial={initial?.night}
        readOnly={readOnly}
        stagingByAssetId={stagingByAssetId}
      />

      {!readOnly ? (
        <ServerActionSubmit
          aria-label={initial?.id ? "Save revision" : "Create revision"}
        >
          {initial?.id ? "Save revision" : "Create revision"}
        </ServerActionSubmit>
      ) : (
        <p className="text-sm text-textMuted">
          {initial?.status === "draft"
            ? "View only."
            : "Published revisions are immutable. Create a new revision to change content."}
        </p>
      )}
    </ServerActionForm>
  );
}
