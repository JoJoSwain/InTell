"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  GroupedChecklist,
  type ChecklistFailure,
} from "@/components/checklist-badges";
import {
  cancelScheduleForm,
  checkPreview,
  copyToNewDraftForm,
  publishNow,
  retryFailedForm,
  runPublishCheck,
  scheduleRelease,
  type PreviewSummary,
} from "./actions";

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

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReleaseActionsPanel({
  releaseId,
  status,
  publishAt,
  canPublish,
  canPreview,
  initialFailures,
}: {
  releaseId: string;
  status: string;
  publishAt: string | null;
  canPublish: boolean;
  canPreview: boolean;
  initialFailures: ChecklistFailure[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failures, setFailures] = useState(initialFailures);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const abbr = zoneAbbr();

  useEffect(() => {
    if (status !== "publishing") return;
    const t = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [status, router]);

  function onRunCheck() {
    setCheckMessage(null);
    startTransition(async () => {
      const result = await runPublishCheck(releaseId);
      if (!result.ok) {
        setCheckMessage(result.error);
        return;
      }
      setFailures(result.failures);
      setCheckMessage(
        result.checkOk
          ? "Checklist passed (warnings may remain)."
          : "Checklist found errors.",
      );
      router.refresh();
    });
  }

  function onPublish() {
    setPublishError(null);
    startTransition(async () => {
      const result = await publishNow(releaseId);
      if (!result.ok) {
        setPublishError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onPreview() {
    setPreviewError(null);
    setPreview(null);
    startTransition(async () => {
      const result = await checkPreview(releaseId);
      if (!result.ok) {
        setPreviewError(result.error);
        return;
      }
      setPreview(result.summary);
    });
  }

  const editableStatuses = ["draft", "scheduled", "failed"];
  const showSchedule = canPublish && editableStatuses.includes(status);
  const showPublish =
    canPublish && (status === "draft" || status === "failed");
  const showCancel = canPublish && status === "scheduled";
  const showRetry = canPublish && status === "failed";
  const showCopy = canPublish && status === "cancelled";
  const showPreviewBtn =
    canPreview && ["draft", "scheduled", "failed"].includes(status);

  return (
    <div className="space-y-8">
      {status === "publishing" ? (
        <p className="text-sm text-water" aria-live="polite">
          Publishing… refreshing until published or failed.
        </p>
      ) : null}

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-xl font-semibold">Checklist</h2>
          {canPublish ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onRunCheck}
              disabled={pending}
              aria-label="Run publish checklist"
            >
              Run checklist
            </Button>
          ) : (
            <p className="text-xs text-textMuted">
              Editors run the check; all staff can read results.
            </p>
          )}
        </div>
        {checkMessage ? (
          <p className="mt-2 text-sm text-textMuted" role="status">
            {checkMessage}
          </p>
        ) : null}
        <div className="mt-4">
          {failures.length ? (
            <GroupedChecklist failures={failures} />
          ) : (
            <p className="text-sm text-textMuted">No checklist failures stored.</p>
          )}
        </div>
      </section>

      {showPublish ? (
        <section>
          <h2 className="font-serif text-xl font-semibold">Publish now</h2>
          <p className="mt-1 text-sm text-textMuted">
            Runs check, copies staged assets, commits, then builds packs.
          </p>
          <Button
            type="button"
            className="mt-3"
            onClick={onPublish}
            disabled={pending}
            aria-label="Publish release now"
          >
            Publish now
          </Button>
          {publishError ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {publishError}
            </p>
          ) : null}
        </section>
      ) : null}

      {showSchedule ? (
        <section>
          <h2 className="font-serif text-xl font-semibold">Schedule</h2>
          <p className="mt-1 text-sm text-textMuted">
            Enter time in this browser&apos;s local zone
            {abbr ? ` (${abbr})` : ""}. Stored as timestamptz (UTC).
          </p>
          <form action={scheduleRelease} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="release_id" value={releaseId} />
            <label className="block text-sm">
              <span className="text-textMuted">
                Publish at{abbr ? ` (${abbr})` : ""}
              </span>
              <input
                type="datetime-local"
                name="publish_at_local"
                required
                defaultValue={toDatetimeLocalValue(publishAt)}
                aria-label={`Publish at local time${abbr ? ` ${abbr}` : ""}`}
                className="mt-1 block rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <Button type="submit" variant="secondary" aria-label="Schedule release">
              Schedule
            </Button>
          </form>
        </section>
      ) : null}

      {showCancel ? (
        <form action={cancelScheduleForm}>
          <input type="hidden" name="release_id" value={releaseId} />
          <Button
            type="submit"
            variant="outline"
            aria-label="Cancel scheduled release"
          >
            Cancel schedule
          </Button>
        </form>
      ) : null}

      {showRetry ? (
        <section className="space-y-2">
          <h2 className="font-serif text-xl font-semibold">Retry</h2>
          <div className="flex flex-wrap gap-2">
            <form action={retryFailedForm}>
              <input type="hidden" name="release_id" value={releaseId} />
              <input type="hidden" name="mode" value="draft" />
              <Button type="submit" variant="secondary" aria-label="Return failed release to draft">
                Return to draft
              </Button>
            </form>
            <form action={retryFailedForm}>
              <input type="hidden" name="release_id" value={releaseId} />
              <input type="hidden" name="mode" value="publish" />
              <Button type="submit" aria-label="Retry publish">
                Retry publish
              </Button>
            </form>
          </div>
        </section>
      ) : null}

      {showCopy ? (
        <form action={copyToNewDraftForm}>
          <input type="hidden" name="release_id" value={releaseId} />
          <Button
            type="submit"
            variant="secondary"
            aria-label="Copy items into a new draft release"
          >
            Copy items into new draft
          </Button>
        </form>
      ) : null}

      {showPreviewBtn ? (
        <section>
          <h2 className="font-serif text-xl font-semibold">Preview</h2>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={onPreview}
            disabled={pending}
            aria-label="Check preview"
          >
            Check preview
          </Button>
          {previewError ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {previewError}
            </p>
          ) : null}
          {preview ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:max-w-sm">
              <dt className="text-textMuted">Groves</dt>
              <dd>{preview.groves}</dd>
              <dt className="text-textMuted">Fragments</dt>
              <dd>{preview.fragments}</dd>
              <dt className="text-textMuted">Assets</dt>
              <dd>{preview.assetCount}</dd>
              <dt className="text-textMuted">Expires</dt>
              <dd>
                {preview.expiresAt
                  ? new Date(preview.expiresAt).toLocaleString()
                  : "—"}
              </dd>
            </dl>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
