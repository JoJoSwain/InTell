import { cn } from "@/lib/utils";

export type ChecklistFailure = {
  code: string;
  severity: string;
  message: string;
  entity?: string;
  entity_id?: string;
};

/** Render failures from fn_draft_check / fn_publish_check. */
export function ChecklistBadges({
  failures,
  className,
}: {
  failures: ChecklistFailure[];
  className?: string;
}) {
  if (!failures.length) return null;
  return (
    <ul
      className={cn("flex flex-wrap gap-2", className)}
      aria-label="Checklist issues"
    >
      {failures.map((f, i) => (
        <li key={`${f.code}-${f.entity_id ?? ""}-${i}`}>
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
              f.severity === "error"
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
            title={f.message}
            aria-label={`${f.code}: ${f.message}`}
          >
            {f.code}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AudioWarningBadges({
  loudness,
  format,
  className,
}: {
  loudness?: boolean;
  format?: boolean;
  className?: string;
}) {
  const items: ChecklistFailure[] = [];
  if (loudness) {
    items.push({
      code: "LOUDNESS",
      severity: "warning",
      message: "loudness off target or not measured",
    });
  }
  if (format) {
    items.push({
      code: "AUDIO_FORMAT",
      severity: "warning",
      message: "format differs from AUDIO_SPEC",
    });
  }
  return <ChecklistBadges failures={items} className={className} />;
}
