import {
  bedLongWarningMessage,
  bedMonoRejectedMessage,
} from "@/lib/sound/helpers";

export function BedAssetHints({
  kind,
  channels,
  durationMs,
}: {
  kind: string;
  channels: number;
  durationMs: number;
}) {
  if (kind !== "sfx_bed" && kind !== "bed") return null;
  const mono = bedMonoRejectedMessage(channels);
  const long = bedLongWarningMessage(durationMs);
  if (!mono && !long) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm" aria-label="Bed publish checks">
      {mono ? (
        <li className="text-destructive" role="alert">
          {mono}
        </li>
      ) : null}
      {long ? <li className="text-muted-foreground">{long}</li> : null}
    </ul>
  );
}