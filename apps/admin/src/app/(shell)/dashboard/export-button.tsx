"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ExportArchiveButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        aria-label="Download story archive zip"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await fetch("/dashboard/export", { method: "POST" });
            if (!res.ok) {
              const body = (await res.json().catch(() => ({}))) as {
                error?: string;
              };
              setError(body.error ?? `Export failed (${res.status})`);
              return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "intell-archive.zip";
            a.click();
            URL.revokeObjectURL(url);
          });
        }}
      >
        {pending ? "Exporting…" : "Export archive"}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
