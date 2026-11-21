"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  checkPreview,
  publishNow,
  runPublishCheck,
  type PreviewSummary,
} from "./actions";

export function RunCheckButton({ releaseId }: { releaseId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await runPublishCheck(releaseId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
        aria-label="Run publish checklist"
      >
        Run checklist
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PublishNowButton({ releaseId }: { releaseId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await publishNow(releaseId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
        aria-label="Publish release now"
      >
        Publish now
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PreviewCheckButton({ releaseId }: { releaseId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          setSummary(null);
          startTransition(async () => {
            const result = await checkPreview(releaseId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setSummary(result.summary);
          });
        }}
        aria-label="Check preview"
      >
        Check preview
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {summary ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:max-w-sm">
          <dt className="text-textMuted">Groves</dt>
          <dd>{summary.groves}</dd>
          <dt className="text-textMuted">Fragments</dt>
          <dd>{summary.fragments}</dd>
          <dt className="text-textMuted">Assets</dt>
          <dd>{summary.assetCount}</dd>
          <dt className="text-textMuted">Expires</dt>
          <dd>
            {summary.expiresAt
              ? new Date(summary.expiresAt).toLocaleString()
              : "—"}
          </dd>
        </dl>
      ) : null}
    </div>
  );
}

function zoneAbbr(d = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function ScheduleForm({
  releaseId,
  action,
  defaultLocal,
}: {
  releaseId: string;
  action: (formData: FormData) => Promise<void>;
  defaultLocal?: string;
}) {
  const abbr = zoneAbbr();
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="release_id" value={releaseId} />
      <label className="block text-sm">
        <span className="text-textMuted">
          Publish at{abbr ? ` (${abbr})` : ""}
        </span>
        <input
          type="datetime-local"
          name="publish_at_local"
          required
          defaultValue={defaultLocal}
          aria-label={`Publish at local time${abbr ? ` ${abbr}` : ""}`}
          className="mt-1 block rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <Button type="submit" variant="secondary" aria-label="Schedule release">
        Schedule
      </Button>
    </form>
  );
}

/** Poll while status is publishing until published or failed. */
export function PublishingPoll() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <p className="mt-4 text-sm text-water" aria-live="polite">
      Publishing… refreshing until published or failed.
    </p>
  );
}
