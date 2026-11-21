import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  entityAdminHref,
  hrefContextFromFailure,
} from "@/lib/releases/links";

export type ChecklistFailure = {
  code: string;
  severity: string;
  message: string;
  entity?: string;
  entity_id?: string;
  grove_id?: string;
  fragment_id?: string;
  character_id?: string;
};

function parseFailures(raw: unknown): ChecklistFailure[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ChecklistFailure[];
  if (typeof raw === "object" && raw !== null && "failures" in raw) {
    const f = (raw as { failures?: unknown }).failures;
    return Array.isArray(f) ? (f as ChecklistFailure[]) : [];
  }
  return [];
}

export function failuresFromLastCheck(lastCheck: unknown): ChecklistFailure[] {
  return parseFailures(lastCheck);
}

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

/**
 * Grouped checklist for release detail: by code, then entity.
 * Warnings are non-blocking; errors block publish.
 */
export function GroupedChecklist({
  failures,
  className,
}: {
  failures: ChecklistFailure[];
  className?: string;
}) {
  if (!failures.length) return null;

  const byCode = new Map<string, ChecklistFailure[]>();
  for (const f of failures) {
    const list = byCode.get(f.code) ?? [];
    list.push(f);
    byCode.set(f.code, list);
  }

  const codes = [...byCode.keys()].sort();

  return (
    <div className={cn("space-y-4", className)} aria-label="Checklist results">
      {codes.map((code) => {
        const items = byCode.get(code) ?? [];
        const severity = items[0]?.severity ?? "error";
        return (
          <div key={code}>
            <h4
              className={cn(
                "text-sm font-medium",
                severity === "error" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {code}
              {severity === "warning" ? " (warning)" : ""}
            </h4>
            <ul className="mt-2 space-y-1">
              {items.map((f, i) => {
                const href = entityAdminHref(
                  f.entity ?? "",
                  f.entity_id,
                  hrefContextFromFailure(f),
                );
                return (
                  <li
                    key={`${code}-${f.entity_id ?? ""}-${i}`}
                    className="text-sm text-textMuted"
                  >
                    {href ? (
                      <Link
                        href={href}
                        className="text-primary underline-offset-2 hover:underline"
                        aria-label={`${f.code}: ${f.message}`}
                      >
                        {f.message}
                        {f.entity && f.entity_id
                          ? ` · ${f.entity} ${f.entity_id.slice(0, 8)}`
                          : ""}
                      </Link>
                    ) : (
                      <span aria-label={`${f.code}: ${f.message}`}>
                        {f.message}
                        {f.entity && f.entity_id
                          ? ` · ${f.entity} ${f.entity_id.slice(0, 8)}`
                          : ""}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
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
