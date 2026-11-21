import { cn } from "@/lib/utils";

export type ReleaseBadgeKind = "draft" | "unreleased" | null;

/**
 * Draft = never published (no snapshot). Unreleased changes = in fn_unreleased.
 * Story Notes–only edits do not flip unreleased (projection equality).
 */
export function UnreleasedBadge({
  kind,
  className,
}: {
  kind: ReleaseBadgeKind;
  className?: string;
}) {
  if (!kind) return null;
  const label = kind === "draft" ? "Draft" : "Unreleased changes";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        kind === "draft"
          ? "bg-muted text-textMuted"
          : "bg-water/20 text-water",
        className,
      )}
      aria-label={label}
    >
      {label}
    </span>
  );
}

export function releaseBadgeKind(
  entityId: string,
  unreleasedIds: Set<string>,
  publishedIds: Set<string>,
): ReleaseBadgeKind {
  if (unreleasedIds.has(entityId)) return "unreleased";
  if (!publishedIds.has(entityId)) return "draft";
  return null;
}
