"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_TRIGGER_RADIUS_FT,
  MAX_TRIGGER_RADIUS_FT,
  MIN_TRIGGER_RADIUS_FT,
  metersToFeet,
} from "@intell/shared";
import { Button } from "@/components/ui/button";
import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { generateMarkerCode } from "@/lib/markers/code";
import {
  rotateMarkerCode,
  saveFragment,
  saveFragmentIndigeny,
  savePrereqGroups,
  saveFragmentCharacters,
} from "./actions";

type FragmentInitial = {
  id?: string;
  title_en: string;
  teaser_en: string;
  tier: string;
  visibility: string;
  /** null when location could not be read — never invent coordinates. */
  lat: number | null;
  lng: number | null;
  story_order: number;
  is_ending: boolean;
  trigger_radius_m: number;
  marker_code: string | null;
  indigeny_earth: string;
  indigeny_world: string;
  indigeny_body: string;
  beacon_asset_id?: string | null;
  resolve_asset_id?: string | null;
  teaser_locked_asset_id?: string | null;
};

type PrereqGroup = { members: string[] };

type CharLink = {
  character_id: string;
  prominence: string;
  introduces: boolean;
  card_line_en: string;
};

export function FragmentForm({
  groveId,
  initial,
  canEdit,
  canNotes,
  allFragments,
  characters,
  prereqGroups,
  characterLinks,
  soundAssets = [],
}: {
  groveId: string;
  initial?: FragmentInitial;
  canEdit: boolean;
  canNotes: boolean;
  allFragments: { id: string; title: string; grove_id: string }[];
  characters: { id: string; name: string }[];
  prereqGroups: PrereqGroup[];
  characterLinks: CharLink[];
  soundAssets?: { id: string; title: string; kind: string }[];
}) {
  const [visibility, setVisibility] = useState(
    initial?.visibility ?? "standard",
  );
  const [markerCode, setMarkerCode] = useState(initial?.marker_code ?? "");
  const [groups, setGroups] = useState<PrereqGroup[]>(
    prereqGroups.length ? prereqGroups : [],
  );
  const [links, setLinks] = useState<CharLink[]>(characterLinks);

  const radiusFt = useMemo(() => {
    if (!initial) return DEFAULT_TRIGGER_RADIUS_FT;
    return Math.round(metersToFeet(initial.trigger_radius_m));
  }, [initial]);

  const latStr =
    initial?.lat !== null && initial?.lat !== undefined
      ? String(initial.lat)
      : "";
  const lngStr =
    initial?.lng !== null && initial?.lng !== undefined
      ? String(initial.lng)
      : "";

  function onVisibilityChange(next: string) {
    setVisibility(next);
    if (next === "physical" && !markerCode) {
      setMarkerCode(generateMarkerCode());
    }
  }

  return (
    <div className="space-y-8">
      {!canEdit && !canNotes ? (
        <p className="text-sm text-textMuted">View only.</p>
      ) : null}
      {initial?.id ? (
        <p className="text-sm">
          <Link
            href={`/story/groves/${groveId}/fragments/${initial.id}/revisions`}
            className="font-medium text-primary underline-offset-4 hover:underline"
            aria-label="Open fragment revisions"
          >
            Revisions
          </Link>
        </p>
      ) : null}
      {canEdit ? (
        <ServerActionForm action={saveFragment} className="space-y-4">
          {initial?.id ? (
            <input type="hidden" name="id" value={initial.id} />
          ) : null}
          <input type="hidden" name="grove_id" value={groveId} />
          <input type="hidden" name="marker_code" value={markerCode} />
          {latStr && lngStr ? (
            <>
              <input type="hidden" name="original_lat" value={latStr} />
              <input type="hidden" name="original_lng" value={lngStr} />
            </>
          ) : null}

          <label className="block text-sm">
            <span className="text-textMuted">Title (en)</span>
            <input
              name="title_en"
              required
              defaultValue={initial?.title_en}
              aria-label="Fragment title"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Teaser (en)</span>
            <textarea
              name="teaser_en"
              rows={2}
              defaultValue={initial?.teaser_en}
              aria-label="Teaser"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-textMuted">Tier</span>
              <select
                name="tier"
                defaultValue={initial?.tier ?? "leaf"}
                aria-label="Tier"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="root">root</option>
                <option value="branch">branch</option>
                <option value="leaf">leaf</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-textMuted">Visibility</span>
              <select
                name="visibility"
                value={visibility}
                onChange={(e) => onVisibilityChange(e.target.value)}
                aria-label="Visibility"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="standard">standard</option>
                <option value="physical">physical</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-textMuted">Latitude</span>
              <input
                name="lat"
                type="number"
                step="any"
                required
                defaultValue={latStr}
                aria-label="Latitude"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-textMuted">Longitude</span>
              <input
                name="lng"
                type="number"
                step="any"
                required
                defaultValue={lngStr}
                aria-label="Longitude"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          </div>
          {visibility === "standard" ? (
            <label className="block text-sm">
              <span className="text-textMuted">
                Trigger radius (feet, {MIN_TRIGGER_RADIUS_FT}–
                {MAX_TRIGGER_RADIUS_FT})
              </span>
              <input
                name="radius_ft"
                type="number"
                min={MIN_TRIGGER_RADIUS_FT}
                max={MAX_TRIGGER_RADIUS_FT}
                defaultValue={radiusFt}
                aria-label="Trigger radius in feet"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-textMuted">
                Physical marker code (not printed for standard):{" "}
                <span className="font-mono">{markerCode || "(none)"}</span>
              </p>
              {initial?.id && markerCode ? (
                <Link
                  href={`/print/marker/${initial.id}`}
                  className="text-primary underline"
                >
                  Print marker
                </Link>
              ) : null}
            </div>
          )}
          <label className="block text-sm">
            <span className="text-textMuted">Story order</span>
            <input
              name="story_order"
              type="number"
              defaultValue={initial?.story_order ?? 0}
              aria-label="Story order"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_ending"
              defaultChecked={initial?.is_ending}
              aria-label="Is ending"
            />
            Ending fragment
          </label>
          <fieldset className="space-y-3 rounded-md border border-border p-4">
            <legend className="px-1 text-sm font-medium">Sound overrides</legend>
            {(
              [
                ["beacon_asset_id", "Beacon", initial?.beacon_asset_id],
                ["resolve_asset_id", "Resolve override", initial?.resolve_asset_id],
                [
                  "teaser_locked_asset_id",
                  "Locked teaser",
                  initial?.teaser_locked_asset_id,
                ],
              ] as const
            ).map(([name, label, value]) => (
              <label key={name} className="block text-sm">
                <span className="text-textMuted">{label}</span>
                <select
                  name={name}
                  defaultValue={value ?? ""}
                  aria-label={label}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="">Grove default / none</option>
                  {soundAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                      {a.kind !== "narration" ? ` (${a.kind})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          <label className="block text-sm">
            <span className="text-textMuted">Indigeny — Earth</span>
            <textarea
              name="indigeny_earth"
              rows={2}
              defaultValue={initial?.indigeny_earth}
              aria-label="Indigeny Earth"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Indigeny — World</span>
            <textarea
              name="indigeny_world"
              rows={2}
              defaultValue={initial?.indigeny_world}
              aria-label="Indigeny World"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Indigeny — Body</span>
            <textarea
              name="indigeny_body"
              rows={2}
              defaultValue={initial?.indigeny_body}
              aria-label="Indigeny Body"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <ServerActionSubmit>
            {initial?.id ? "Save fragment" : "Add fragment"}
          </ServerActionSubmit>
        </ServerActionForm>
      ) : canNotes && initial?.id ? (
        <ServerActionForm action={saveFragmentIndigeny} className="space-y-4">
          <input type="hidden" name="id" value={initial.id} />
          <input type="hidden" name="grove_id" value={groveId} />
          <label className="block text-sm">
            <span className="text-textMuted">Indigeny — Earth</span>
            <textarea
              name="indigeny_earth"
              rows={2}
              defaultValue={initial.indigeny_earth}
              aria-label="Indigeny Earth"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Indigeny — World</span>
            <textarea
              name="indigeny_world"
              rows={2}
              defaultValue={initial.indigeny_world}
              aria-label="Indigeny World"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Indigeny — Body</span>
            <textarea
              name="indigeny_body"
              rows={2}
              defaultValue={initial.indigeny_body}
              aria-label="Indigeny Body"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <ServerActionSubmit aria-label="Save Story Notes">
            Save Story Notes
          </ServerActionSubmit>
        </ServerActionForm>
      ) : null}

      {canEdit && initial?.id && visibility === "physical" ? (
        <form action={rotateMarkerCode} className="space-y-2">
          <input type="hidden" name="id" value={initial.id} />
          <input type="hidden" name="grove_id" value={groveId} />
          <Button type="submit" variant="secondary" aria-label="Rotate marker code">
            Rotate marker code
          </Button>
        </form>
      ) : null}

      {canEdit && initial?.id ? (
        <section className="space-y-3">
          <h3 className="font-serif text-lg font-semibold">Prerequisites</h3>
          <p className="text-sm text-textMuted">
            OR groups: any member in a group unlocks; all groups must be
            satisfied. Members may be from any grove.
          </p>
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-md border border-border p-3">
              <p className="text-xs uppercase text-textMuted">OR group {gi + 1}</p>
              <select
                multiple
                aria-label={`Prerequisite group ${gi + 1} members`}
                className="mt-2 h-28 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={g.members}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map(
                    (o) => o.value,
                  );
                  setGroups((prev) =>
                    prev.map((x, i) =>
                      i === gi ? { members: selected } : x,
                    ),
                  );
                }}
              >
                {allFragments
                  .filter((f) => f.id !== initial.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() =>
                  setGroups((prev) => prev.filter((_, i) => i !== gi))
                }
              >
                Remove group
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setGroups((prev) => [...prev, { members: [] }])}
          >
            Add OR group
          </Button>
          <form action={savePrereqGroups}>
            <input type="hidden" name="fragment_id" value={initial.id} />
            <input type="hidden" name="grove_id" value={groveId} />
            <input
              type="hidden"
              name="prereq_json"
              value={JSON.stringify(groups)}
            />
            <Button type="submit">Save prerequisites</Button>
          </form>
        </section>
      ) : null}

      {canNotes && initial?.id ? (
        <section className="space-y-3">
          <h3 className="font-serif text-lg font-semibold">Characters</h3>
          {links.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-border p-3">
              <select
                aria-label={`Character ${i + 1}`}
                value={l.character_id}
                onChange={(e) =>
                  setLinks((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, character_id: e.target.value } : x,
                    ),
                  )
                }
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Prominence ${i + 1}`}
                value={l.prominence}
                onChange={(e) =>
                  setLinks((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, prominence: e.target.value } : x,
                    ),
                  )
                }
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
              >
                <option value="major">major</option>
                <option value="minor">minor</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={l.introduces}
                  onChange={(e) =>
                    setLinks((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, introduces: e.target.checked } : x,
                      ),
                    )
                  }
                  aria-label={`Introduces ${i + 1}`}
                />
                Introduces
              </label>
              <input
                aria-label={`Card line ${i + 1}`}
                value={l.card_line_en}
                onChange={(e) =>
                  setLinks((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, card_line_en: e.target.value } : x,
                    ),
                  )
                }
                placeholder="Card line (en)"
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setLinks((prev) => prev.filter((_, j) => j !== i))
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setLinks((prev) => [
                ...prev,
                {
                  character_id: characters[0]?.id ?? "",
                  prominence: "minor",
                  introduces: false,
                  card_line_en: "",
                },
              ])
            }
            disabled={!characters.length}
          >
            Add character link
          </Button>
          <form action={saveFragmentCharacters}>
            <input type="hidden" name="fragment_id" value={initial.id} />
            <input type="hidden" name="grove_id" value={groveId} />
            <input
              type="hidden"
              name="characters_json"
              value={JSON.stringify(links)}
            />
            <Button type="submit">Save character links</Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
