"use client";

/**
 * Draggable breath / swell markers on a wavesurfer waveform.
 * Shared by revision editors and the Simulator narration bar.
 */
import { useEffect, useId, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { Button } from "@/components/ui/button";
import { formatIntArray } from "@/lib/sound/helpers";

export type WaveformMarkersProps = {
  /** Hidden input name for form submit (comma-separated ms). */
  name?: string;
  label: string;
  kind: "breath" | "swell";
  valueMs: number[];
  durationMs: number;
  /** Optional audio URL for waveform; without it, shows a scrub bar only. */
  audioUrl?: string | null;
  disabled?: boolean;
  onChange?: (ms: number[]) => void;
  /** Highlight playhead (Simulator). */
  playheadMs?: number;
};

function clampMs(ms: number, durationMs: number): number {
  return Math.max(0, Math.min(durationMs, Math.round(ms)));
}

export function WaveformMarkers({
  name,
  label,
  kind,
  valueMs,
  durationMs,
  audioUrl,
  disabled,
  onChange,
  playheadMs,
}: WaveformMarkersProps) {
  const id = useId();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [points, setPoints] = useState(() =>
    [...valueMs].sort((a, b) => a - b),
  );
  const color = kind === "breath" ? "rgba(47, 111, 78, 0.85)" : "rgba(180, 100, 40, 0.85)";

  useEffect(() => {
    setPoints([...valueMs].sort((a, b) => a - b));
  }, [valueMs]);

  useEffect(() => {
    if (!hostRef.current || durationMs <= 0) return;
    let cancelled = false;
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: hostRef.current,
      height: 64,
      waveColor: "#c5c0b5",
      progressColor: "#2f6f4e",
      cursorColor: "#1a1a1a",
      interact: !disabled,
      plugins: [regions],
      url: audioUrl ?? undefined,
      peaks: audioUrl
        ? undefined
        : [Array.from({ length: 128 }, (_, i) => Math.sin(i / 8) * 0.3)],
      duration: audioUrl ? undefined : durationMs / 1000,
    });
    wsRef.current = ws;

    const syncFromRegions = () => {
      const ms = regions
        .getRegions()
        .map((r) => clampMs((r.start ?? 0) * 1000, durationMs))
        .sort((a, b) => a - b);
      setPoints(ms);
      onChange?.(ms);
    };

    ws.on("ready", () => {
      if (cancelled) return;
      for (const p of points) {
        regions.addRegion({
          start: p / 1000,
          end: p / 1000 + 0.05,
          drag: !disabled,
          resize: false,
          color,
          content: kind === "breath" ? "B" : "S",
        });
      }
    });
    regions.on("region-updated", syncFromRegions);

    return () => {
      cancelled = true;
      ws.destroy();
      wsRef.current = null;
    };
    // Re-init when URL / duration changes; points applied on ready from closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [audioUrl, durationMs, disabled, kind, color]);

  useEffect(() => {
    if (playheadMs == null || !wsRef.current || durationMs <= 0) return;
    wsRef.current.setTime(playheadMs / 1000);
  }, [playheadMs, durationMs]);

  function addAtPlayhead() {
    if (disabled) return;
    const t =
      playheadMs != null
        ? playheadMs
        : durationMs / 2;
    const next = [...points, clampMs(t, durationMs)].sort((a, b) => a - b);
    setPoints(next);
    onChange?.(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm text-textMuted" htmlFor={id}>
          {label}
        </label>
        {!disabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAtPlayhead}
            aria-label={`Add ${kind} marker`}
          >
            Add {kind}
          </Button>
        ) : null}
      </div>
      <div
        ref={hostRef}
        id={id}
        className="w-full overflow-hidden rounded-md border border-border bg-background"
        role="img"
        aria-label={`${label} waveform`}
      />
      {name ? (
        <input type="hidden" name={name} value={formatIntArray(points)} readOnly />
      ) : null}
      <p className="font-mono text-xs text-textMuted" aria-live="polite">
        {formatIntArray(points) || "(none)"}
      </p>
    </div>
  );
}
