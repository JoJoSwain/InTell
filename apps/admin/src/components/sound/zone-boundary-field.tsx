"use client";

type Props = {
  name?: string;
  defaultValue: string;
  disabled?: boolean;
};

export function ZoneBoundaryField({
  name = "boundary",
  defaultValue,
  disabled,
}: Props) {
  return (
    <label className="block text-sm">
      <span className="text-textMuted">Boundary (GeoJSON Polygon)</span>
      <textarea
        name={name}
        rows={8}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-label="Zone boundary GeoJSON"
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
        placeholder='{"type":"Polygon","coordinates":[[[lng,lat],...]]}'
      />
      <span className="mt-1 block text-xs text-textMuted">
        Paste a GeoJSON Polygon, or draw on the map when Terra Draw is enabled.
        Leave blank to keep the current boundary.
      </span>
    </label>
  );
}