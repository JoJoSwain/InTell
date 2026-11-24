"use client";

import { useMemo, useState } from "react";
import type { MusicCondition } from "@intell/shared";

type FragmentOption = {
  id: string;
  label: string;
  storyOrder: number;
};

export function MusicConditionBuilder({
  name,
  fragments,
  initial,
  disabled,
}: {
  name: string;
  fragments: FragmentOption[];
  initial: MusicCondition;
  disabled?: boolean;
}) {
  const [heardAll, setHeardAll] = useState<string[]>(initial.heardAll ?? []);
  const [threadIds, setThreadIds] = useState(
    (initial.threadIds ?? []).join(", "),
  );
  const [tiers, setTiers] = useState({
    root: initial.tiers?.includes("root") ?? false,
    branch: initial.tiers?.includes("branch") ?? false,
    leaf: initial.tiers?.includes("leaf") ?? false,
  });
  const [minDepthM, setMinDepthM] = useState(
    initial.minDepthM !== undefined ? String(initial.minDepthM) : "",
  );
  const [insideTierBuffer, setInsideTierBuffer] = useState(
    initial.insideTierBuffer ?? "",
  );
  const [narrationPlaying, setNarrationPlaying] = useState(
    initial.narrationPlaying ?? false,
  );

  const orderedFrags = useMemo(
    () => [...fragments].sort((a, b) => a.storyOrder - b.storyOrder),
    [fragments],
  );

  const conditionsJson = useMemo(() => {
    const cond: MusicCondition = {};
    if (heardAll.length) cond.heardAll = heardAll;
    const threads = threadIds
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (threads.length) cond.threadIds = threads;
    const tierList = (["root", "branch", "leaf"] as const).filter(
      (t) => tiers[t],
    );
    if (tierList.length) cond.tiers = [...tierList];
    const depth = Number(minDepthM);
    if (minDepthM.trim() && Number.isFinite(depth)) cond.minDepthM = depth;
    if (
      insideTierBuffer === "root" ||
      insideTierBuffer === "branch" ||
      insideTierBuffer === "leaf"
    ) {
      cond.insideTierBuffer = insideTierBuffer;
    }
    if (narrationPlaying) cond.narrationPlaying = true;
    return JSON.stringify(cond);
  }, [
    heardAll,
    threadIds,
    tiers,
    minDepthM,
    insideTierBuffer,
    narrationPlaying,
  ]);

  function toggleHeardAll(id: string) {
    setHeardAll((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <fieldset className="space-y-4 rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-medium">Music conditions</legend>
      <input type="hidden" name={name} value={conditionsJson} />

      <div>
        <p className="text-sm text-textMuted">
          After these fragments (heardAll) — growth chain order
        </p>
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {orderedFrags.map((f) => (
            <li key={f.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={heardAll.includes(f.id)}
                  disabled={disabled}
                  onChange={() => toggleHeardAll(f.id)}
                  aria-label={`Heard all after ${f.label}`}
                />
                <span>
                  {f.storyOrder}. {f.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {heardAll.length > 4 ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            More than 4 growth steps in heardAll (publish GROWTH_STEPS_OVER_MAX)
          </p>
        ) : null}
      </div>

      <label className="block text-sm">
        <span className="text-textMuted">Thread IDs (comma-separated UUIDs)</span>
        <input
          value={threadIds}
          onChange={(e) => setThreadIds(e.target.value)}
          disabled={disabled}
          aria-label="Thread IDs"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
        />
      </label>

      <div>
        <p className="text-sm text-textMuted">Tiers</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {(["root", "branch", "leaf"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tiers[t]}
                disabled={disabled}
                onChange={(e) =>
                  setTiers((prev) => ({ ...prev, [t]: e.target.checked }))
                }
                aria-label={`Tier ${t}`}
              />
              {t}
            </label>
          ))}
        </div>
      </div>

      <label className="block text-sm">
        <span className="text-textMuted">minDepthM</span>
        <input
          value={minDepthM}
          onChange={(e) => setMinDepthM(e.target.value)}
          disabled={disabled}
          aria-label="Minimum depth metres"
          className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="text-textMuted">insideTierBuffer</span>
        <select
          value={insideTierBuffer}
          onChange={(e) => setInsideTierBuffer(e.target.value)}
          disabled={disabled}
          aria-label="Inside tier buffer"
          className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="">—</option>
          <option value="root">root</option>
          <option value="branch">branch</option>
          <option value="leaf">leaf</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={narrationPlaying}
          disabled={disabled}
          onChange={(e) => setNarrationPlaying(e.target.checked)}
          aria-label="Requires narration playing"
        />
        narrationPlaying
      </label>
    </fieldset>
  );
}