"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  RELEASE_ITEM_ENTITIES,
  type ReleaseItemEntity,
} from "@/lib/releases/links";
import { addReleaseItem } from "./actions";

export type EntityOption = { id: string; label: string };

const ENTITY_LABELS: Record<ReleaseItemEntity, string> = {
  revision: "Revision",
  grove: "Grove",
  fragment: "Fragment",
  character: "Character",
  image: "Image",
};

export function AddItemForm({
  releaseId,
  options,
}: {
  releaseId: string;
  options: Record<ReleaseItemEntity, EntityOption[]>;
}) {
  const [entity, setEntity] = useState<ReleaseItemEntity>("revision");
  const list = useMemo(() => options[entity] ?? [], [options, entity]);

  return (
    <form
      action={addReleaseItem}
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="release_id" value={releaseId} />
      <label className="block text-sm">
        <span className="text-textMuted">Entity type</span>
        <select
          name="entity"
          value={entity}
          onChange={(e) => setEntity(e.target.value as ReleaseItemEntity)}
          aria-label="Release item entity type"
          className="mt-1 block rounded-md border border-input bg-background px-3 py-2"
        >
          {RELEASE_ITEM_ENTITIES.map((e) => (
            <option key={e} value={e}>
              {ENTITY_LABELS[e]}
            </option>
          ))}
        </select>
      </label>
      <label className="block min-w-[16rem] flex-1 text-sm">
        <span className="text-textMuted">{ENTITY_LABELS[entity]}</span>
        <select
          key={entity}
          name="entity_id"
          required
          aria-label={`Select ${ENTITY_LABELS[entity]} to add`}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2"
          defaultValue=""
        >
          <option value="" disabled>
            Select…
          </option>
          {list.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="outline" aria-label="Add release item">
        Add item
      </Button>
    </form>
  );
}
