"use client";

import { Button } from "@/components/ui/button";
import { createRevision, updateRevision } from "./actions";

export type AudioOption = { id: string; title: string; kind: string };

export type VersionInitial = {
  id?: string;
  narration_asset_id: string;
  transcript: string;
  vtt: string;
};

export type RevisionFormInitial = {
  id?: string;
  revision_no?: number;
  change_kind?: "contingency" | "correction" | "";
  change_note?: string;
  status?: string;
  day?: VersionInitial | null;
  night?: VersionInitial | null;
};

function VersionFields({
  window,
  assets,
  initial,
  readOnly,
}: {
  window: "day" | "night";
  assets: AudioOption[];
  initial?: VersionInitial | null;
  readOnly: boolean;
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

  return (
    <form action={action} className="space-y-6">
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

      <p className="text-xs text-textMuted">
        Language is always English (en). No AI generation.
      </p>

      <VersionFields
        window="day"
        assets={audioAssets}
        initial={initial?.day}
        readOnly={readOnly}
      />
      <VersionFields
        window="night"
        assets={audioAssets}
        initial={initial?.night}
        readOnly={readOnly}
      />

      {!readOnly ? (
        <Button type="submit" aria-label={initial?.id ? "Save revision" : "Create revision"}>
          {initial?.id ? "Save revision" : "Create revision"}
        </Button>
      ) : (
        <p className="text-sm text-textMuted">
          {initial?.status === "draft"
            ? "View only."
            : "Published revisions are immutable. Create a new revision to change content."}
        </p>
      )}
    </form>
  );
}
