"use client";

import { useState, useTransition } from "react";
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
  remountKey,
}: {
  groveId: string;
  initial: JourneyInitial;
  canEdit: boolean;
  /** Changes after each save so the form remounts with server values (R1). */
  remountKey: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <p className="text-sm text-textMuted">View only for your role.</p>
    );
  }

  return (
    <form
      key={remountKey}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        setError(null);
        startTransition(async () => {
          try {
            await saveGroveJourneys(formData);
            // Hard navigation avoids soft-nav form restoration that doubled
            // journey passages after save (R1).
            window.location.assign(
              `/story/groves/${groveId}?journeys=${Date.now()}`,
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <input type="hidden" name="grove_id" value={groveId} />
      <p className="text-sm text-textMuted">
        Shown in Embark after a listener picks how to travel. Link this way of
        arriving to the grove&apos;s opening root.
      </p>
      <label className="block text-sm">
        <span className="text-textMuted">On foot</span>
        <textarea
          key={`${remountKey}-walk`}
          name="journey_walk"
          rows={3}
          defaultValue={initial.walk}
          autoComplete="off"
          aria-label="On foot journey passage"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">By bike</span>
        <textarea
          key={`${remountKey}-bike`}
          name="journey_bike"
          rows={3}
          defaultValue={initial.bike}
          autoComplete="off"
          aria-label="By bike journey passage"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">By transit</span>
        <textarea
          key={`${remountKey}-transit`}
          name="journey_transit"
          rows={3}
          defaultValue={initial.transit}
          autoComplete="off"
          aria-label="By transit journey passage"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        aria-label="Save journey passages"
      >
        {pending ? "Saving…" : "Save journey passages"}
      </Button>
    </form>
  );
}
