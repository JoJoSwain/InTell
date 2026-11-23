import {
  farPieces,
  groveShape,
  type GroveShapeFragment,
} from "@intell/shared";
import type { ChecklistFailure } from "@/components/checklist-badges";

export type FragmentForShape = {
  id: string;
  tier: string;
  status?: string | null;
  retired?: boolean | null;
  location_geojson?: { coordinates?: number[] } | null;
};

export function fragmentsForShape(
  fragments: readonly FragmentForShape[],
): GroveShapeFragment[] {
  const out: GroveShapeFragment[] = [];
  for (const fragment of fragments) {
    if (fragment.retired === true || fragment.status === "retired") continue;
    const coords = fragment.location_geojson?.coordinates;
    const lng = coords?.[0];
    const lat = coords?.[1];
    if (lat === undefined || lng === undefined) continue;
    if (fragment.tier !== "root" && fragment.tier !== "branch" && fragment.tier !== "leaf") {
      continue;
    }
    out.push({ id: fragment.id, tier: fragment.tier, lat, lng });
  }
  return out;
}

export function derivedGroveShapeJson(
  fragments: readonly FragmentForShape[],
): string {
  const shape = groveShape(fragmentsForShape(fragments));
  return shape ? JSON.stringify(shape) : "";
}

export function farPieceFailures(
  groveId: string,
  fragments: readonly FragmentForShape[],
): ChecklistFailure[] {
  const shape = groveShape(fragmentsForShape(fragments));
  if (!shape) return [];
  const far = farPieces(shape);
  if (!far.length) return [];
  return [
    {
      code: "GROVE_FAR_PIECE",
      severity: "warning",
      message: `${far.length} piece${far.length === 1 ? "" : "s"} more than 1 km from the rest of this grove`,
      entity: "grove",
      entity_id: groveId,
      grove_id: groveId,
    },
  ];
}
