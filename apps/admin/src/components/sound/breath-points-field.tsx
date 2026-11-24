"use client";

import { useId, useState } from "react";
import { suggestBreathPoints } from "@intell/shared";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { formatIntArray, parseCommaSeparatedInts } from "@/lib/sound/helpers";
import { WaveformMarkers } from "@/components/sound/waveform-markers";

type Props = {
  name: string;
  label: string;
  defaultValue: number[];
  disabled?: boolean;
  /** staging-audio/{sha}.ext — enables Suggest from PCM */
  stagingPath?: string | null;
  /** Show draggable waveform markers (P2b). */
  showWaveform?: boolean;
  kind?: "breath" | "swell";
  durationMs?: number;
};

/**
 * Editable breath/swell ms list; optional Suggest via suggestBreathPoints on
 * decoded staging audio (A5 P2a); optional wavesurfer markers (P2b).
 */
export function BreathPointsField({
  name,
  label,
  defaultValue,
  disabled,
  stagingPath,
  showWaveform = false,
  kind = "breath",
  durationMs = 60_000,
}: Props) {
  const id = useId();
  const [points, setPoints] = useState(() => [...defaultValue].sort((a, b) => a - b));
  const [value, setValue] = useState(formatIntArray(defaultValue));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function applyPoints(next: number[]) {
    const sorted = [...next].sort((a, b) => a - b);
    setPoints(sorted);
    setValue(formatIntArray(sorted));
  }

  async function onSuggest() {
    if (!stagingPath || disabled) return;
    setBusy(true);
    setStatus(null);
    try {
      const supabase = createClient();
      const parts = stagingPath.split("/");
      const bucket = parts[0] ?? "staging-audio";
      const objectPath = parts.slice(1).join("/");
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 600);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? "signed URL failed");
      }
      const res = await fetch(data.signedUrl);
      const bytes = await res.arrayBuffer();
      const OfflineCtx =
        window.OfflineAudioContext ||
        (
          window as unknown as {
            webkitOfflineAudioContext?: typeof OfflineAudioContext;
          }
        ).webkitOfflineAudioContext;
      if (!OfflineCtx) throw new Error("OfflineAudioContext unavailable");
      const ctx = new OfflineCtx(1, 48_000, 48_000);
      const decoded = await ctx.decodeAudioData(bytes.slice(0));
      const ch = decoded.getChannelData(0);
      const suggested = suggestBreathPoints(ch, decoded.sampleRate);
      applyPoints(suggested);
      setStatus(
        suggested.length
          ? `Suggested ${suggested.length} breath point${suggested.length === 1 ? "" : "s"}`
          : "No silences ≥350 ms found",
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Suggest failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm" htmlFor={id}>
        <span className="text-textMuted">{label}</span>
        <input
          id={id}
          name={name}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            try {
              applyPoints(parseCommaSeparatedInts(e.target.value));
            } catch {
              /* keep typing */
            }
          }}
          disabled={disabled}
          aria-label={label}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
        />
      </label>
      {stagingPath && !disabled ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onSuggest()}
          aria-label={`Suggest ${label}`}
        >
          {busy ? "Suggesting…" : "Suggest breath points"}
        </Button>
      ) : null}
      {status ? (
        <p className="text-xs text-textMuted" role="status">
          {status}
        </p>
      ) : null}
      {showWaveform ? (
        <WaveformMarkers
          label={`${kind === "breath" ? "Breath" : "Swell"} waveform`}
          kind={kind}
          valueMs={points}
          durationMs={Math.max(durationMs, ...points, 1000)}
          disabled={disabled}
          onChange={applyPoints}
        />
      ) : null}
    </div>
  );
}
