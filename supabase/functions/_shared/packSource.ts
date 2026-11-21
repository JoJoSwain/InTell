/**
 * Pack assembly sources (M3d D3): published snapshots vs release overlay for preview.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type ReleaseOverlay = {
  releaseId: string;
  /** entity:id → true when the release includes that item */
  items: Set<string>;
  /** fragmentId → revision id when the release includes a revision for that fragment */
  revisionByFragment: Map<string, string>;
  groveIds: Set<string>;
};

export function itemKey(entity: string, id: string): string {
  return `${entity}:${id}`;
}

export async function loadReleaseOverlay(
  supabase: SupabaseClient,
  releaseId: string,
): Promise<ReleaseOverlay> {
  const { data: items, error } = await supabase
    .from("release_items")
    .select("entity, entity_id")
    .eq("release_id", releaseId);
  if (error) throw new Error(`release_items: ${error.message}`);

  const overlay: ReleaseOverlay = {
    releaseId,
    items: new Set(),
    revisionByFragment: new Map(),
    groveIds: new Set(),
  };

  const touchedFragIds = new Set<string>();

  for (const row of items ?? []) {
    const entity = String(row.entity);
    const id = String(row.entity_id);
    overlay.items.add(itemKey(entity, id));

    if (entity === "grove") {
      overlay.groveIds.add(id);
    } else if (entity === "fragment") {
      touchedFragIds.add(id);
      const { data: frag } = await supabase
        .from("fragments")
        .select("grove_id")
        .eq("id", id)
        .maybeSingle();
      if (frag?.grove_id) overlay.groveIds.add(String(frag.grove_id));
    } else if (entity === "revision") {
      const { data: rev } = await supabase
        .from("fragment_revisions")
        .select("fragment_id")
        .eq("id", id)
        .maybeSingle();
      const fragmentId = rev?.fragment_id ? String(rev.fragment_id) : null;
      if (fragmentId) {
        overlay.revisionByFragment.set(fragmentId, id);
        touchedFragIds.add(fragmentId);
        const { data: f } = await supabase
          .from("fragments")
          .select("grove_id")
          .eq("id", fragmentId)
          .maybeSingle();
        if (f?.grove_id) overlay.groveIds.add(String(f.grove_id));
      }
    }
  }

  if (touchedFragIds.size) {
    const { data: members } = await supabase
      .from("fragment_prereq_members")
      .select("requires_fragment_id, group_id")
      .in("requires_fragment_id", [...touchedFragIds]);
    const groupIds = [
      ...new Set((members ?? []).map((m) => String(m.group_id))),
    ];
    if (groupIds.length) {
      const { data: groups } = await supabase
        .from("fragment_prereq_groups")
        .select("id, fragment_id")
        .in("id", groupIds);
      for (const g of groups ?? []) {
        const { data: f } = await supabase
          .from("fragments")
          .select("grove_id")
          .eq("id", g.fragment_id)
          .maybeSingle();
        if (f?.grove_id) overlay.groveIds.add(String(f.grove_id));
      }
    }
  }

  return overlay;
}

export async function projectEntity(
  supabase: SupabaseClient,
  entity: string,
  entityId: string,
): Promise<unknown> {
  const { data, error } = await supabase.rpc("fn_snapshot_projection", {
    p_entity: entity,
    p_entity_id: entityId,
  });
  if (error) {
    throw new Error(`fn_snapshot_projection(${entity}): ${error.message}`);
  }
  return data;
}
