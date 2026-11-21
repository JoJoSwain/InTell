import {
  audioFormatOffTarget,
  loudnessOffTarget,
  type LoudnessAssetKind,
} from "@intell/shared";

export function audioAssetWarnings(row: {
  kind: string;
  ext: string;
  channels: number;
  sample_rate: number;
  bitrate_kbps: number | null;
  loudness_lufs: number | null;
  max_short_term_lufs?: number | null;
}): { loudness: boolean; format: boolean } {
  const kind = row.kind as LoudnessAssetKind;
  const loudness = loudnessOffTarget(
    kind,
    row.loudness_lufs,
    row.max_short_term_lufs ?? null,
  );
  const format = audioFormatOffTarget(kind, {
    ext: row.ext,
    channels: row.channels,
    sampleRate: row.sample_rate,
    bitrateKbps: row.bitrate_kbps ?? 0,
  });
  return { loudness, format };
}
