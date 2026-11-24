"use client";

import { WaveformMarkers } from "@/components/sound/waveform-markers";

/** Simulator narration bar with shared breath / swell markers. */
export function NarrationBar({
  breathMs,
  swellMs,
  durationMs,
  playheadMs,
  onBreathChange,
  onSwellChange,
}: {
  breathMs: number[];
  swellMs: number[];
  durationMs: number;
  playheadMs: number;
  onBreathChange: (ms: number[]) => void;
  onSwellChange: (ms: number[]) => void;
}) {
  return (
    <section
      className="space-y-3 border-t border-border pt-3"
      aria-label="Narration bar"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
        Narration
      </p>
      <WaveformMarkers
        label="Breath markers"
        kind="breath"
        valueMs={breathMs}
        durationMs={durationMs}
        playheadMs={playheadMs}
        onChange={onBreathChange}
      />
      <WaveformMarkers
        label="Swell markers"
        kind="swell"
        valueMs={swellMs}
        durationMs={durationMs}
        playheadMs={playheadMs}
        onChange={onSwellChange}
      />
    </section>
  );
}
