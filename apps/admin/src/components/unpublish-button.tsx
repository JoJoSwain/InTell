"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  previewUnpublish,
  confirmUnpublish,
  type UnpublishEntity,
} from "@/app/(shell)/story/unpublish-actions";
import type { ChecklistFailure } from "@/components/checklist-badges";

export function UnpublishButton({
  entity,
  id,
  label,
}: {
  entity: UnpublishEntity;
  id: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [warnings, setWarnings] = useState<ChecklistFailure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await previewUnpublish(entity, [id]);
      if (!result.ok) {
        setError(result.error);
        setOpen(true);
        return;
      }
      setWarnings(result.warnings);
      setOpen(true);
    });
  }

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmUnpublish(entity, [id]);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={openConfirm}
        disabled={pending}
        aria-label={label ?? `Unpublish ${entity}`}
      >
        {label ?? "Unpublish"}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unpublish-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-md border border-border bg-background p-6 shadow-lg">
            <h2
              id="unpublish-dialog-title"
              className="font-serif text-xl font-semibold"
            >
              Unpublish {entity}?
            </h2>
            <p className="mt-2 text-sm text-textMuted">
              This removes the live snapshot. Packs rebuild without this entity.
            </p>

            {warnings.length > 0 ? (
              <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium text-destructive">
                  Stranded prerequisite warnings
                </p>
                <ul className="mt-2 space-y-1" aria-label="Unpublish warnings">
                  {warnings.map((w, i) => (
                    <li
                      key={`${w.code}-${w.entity_id ?? ""}-${i}`}
                      className="text-sm text-textMuted"
                    >
                      {w.code}: {w.message}
                      {w.entity_id ? ` (${w.entity_id.slice(0, 8)})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-textMuted">
                No stranded-prerequisite warnings.
              </p>
            )}

            {error ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={onConfirm}
                disabled={pending}
                aria-label="Confirm unpublish"
              >
                Confirm unpublish
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
                aria-label="Cancel unpublish"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
