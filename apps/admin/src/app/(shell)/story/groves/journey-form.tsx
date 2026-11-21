"use client";

import { Button } from "@/components/ui/button";
import { saveGroveJourneys } from "./actions";

export type JourneyInitial = {
  walk: string;
  bike: string;
  transit: string;
};

export function JourneyForm({
  groveId,
  initial,
  canEdit,
}: {
  groveId: string;
  initial: JourneyInitial;
  canEdit: boolean;
}) {
  if (!canEdit) {
    return (
      <p className="text-sm text-textMuted">View only for your role.</p>
    );
  }

  return (
    <form action={saveGroveJourneys} className="space-y-4">
      <input type="hidden" name="grove_id" value={groveId} />
      <p className="text-sm text-textMuted">
        Shown in Embark after a listener picks how to travel. Link this way of
        arriving to the grove&apos;s opening root.
      </p>
      <label className="block text-sm">
        <span className="text-textMuted">On foot</span>
        <textarea
          name="journey_walk"
          rows={3}
          defaultValue={initial.walk}
          aria-label="On foot journey passage"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">By bike</span>
        <textarea
          name="journey_bike"
          rows={3}
          defaultValue={initial.bike}
          aria-label="By bike journey passage"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">By transit</span>
        <textarea
          name="journey_transit"
          rows={3}
          defaultValue={initial.transit}
          aria-label="By transit journey passage"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <Button type="submit" aria-label="Save journey passages">
        Save journey passages
      </Button>
    </form>
  );
}
