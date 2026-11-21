import Link from "next/link";
import { Button } from "@/components/ui/button";
import { entityAdminHref, type ReleaseItemEntity } from "@/lib/releases/links";
import { removeReleaseItem } from "./actions";
import { AddItemForm } from "./add-item-form";

export type ReleaseItemRow = {
  entity: string;
  entity_id: string;
  label?: string;
};

export function ReleaseItemsSection({
  releaseId,
  items,
  canEdit,
  pickers,
}: {
  releaseId: string;
  items: ReleaseItemRow[];
  canEdit: boolean;
  pickers: Record<ReleaseItemEntity, { id: string; label: string }[]>;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-xl font-semibold">Items</h2>
      <ul className="divide-y divide-border border-y border-border">
        {items.map((item) => {
          const href = entityAdminHref(item.entity, item.entity_id);
          return (
            <li
              key={`${item.entity}-${item.entity_id}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="text-sm">
                <span className="font-medium capitalize">{item.entity}</span>
                {" · "}
                {href ? (
                  <Link
                    href={href}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {item.label ?? item.entity_id.slice(0, 8)}
                  </Link>
                ) : (
                  <span>{item.label ?? item.entity_id.slice(0, 8)}</span>
                )}
              </div>
              {canEdit ? (
                <form action={removeReleaseItem}>
                  <input type="hidden" name="release_id" value={releaseId} />
                  <input type="hidden" name="entity" value={item.entity} />
                  <input type="hidden" name="entity_id" value={item.entity_id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${item.entity} ${item.entity_id}`}
                  >
                    Remove
                  </Button>
                </form>
              ) : null}
            </li>
          );
        })}
        {items.length === 0 ? (
          <li className="py-4 text-sm text-textMuted">No items yet.</li>
        ) : null}
      </ul>

      {canEdit ? (
        <AddItemForm releaseId={releaseId} options={pickers} />
      ) : null}
    </section>
  );
}
