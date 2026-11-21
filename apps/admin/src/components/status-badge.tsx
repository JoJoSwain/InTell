import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-water/20 text-water",
  published: "bg-primary/15 text-primary",
  publishing: "bg-water/20 text-water",
  failed: "bg-destructive/15 text-destructive",
  retired: "border border-border text-muted-foreground bg-transparent",
  unpublished: "border border-destructive/40 text-destructive bg-transparent",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        styles[key] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {status}
    </span>
  );
}
