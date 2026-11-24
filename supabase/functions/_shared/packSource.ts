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

/**
 * Full working-row overlay for one grove (Simulator / staff preview without a
 * release). Includes the grove, its fragments and current revisions, linked
 * characters and portraits, grove-bound music cues, and the region's sound
 * entities so unreleased edits reach the pack assembler.
 */
export async function loadGroveWorkingOverlay(
  supabase: SupabaseClient,
  groveId: string,
): Promise<ReleaseOverlay> {
  const overlay: ReleaseOverlay = {
    releaseId: "00000000-0000-4000-8000-000000000000",
    items: new Set(),
    revisionByFragment: new Map(),
    groveIds: new Set([groveId]),
  };
  overlay.items.add(itemKey("grove", groveId));

  const { data: grove } = await supabase
    .from("groves")
    .select("region_id")
    .eq("id", groveId)
    .maybeSingle();
  const regionId = grove?.region_id ? String(grove.region_id) : null;

  const { data: frags } = await supabase
    .from("fragments")
    .select("id")
    .eq("grove_id", groveId);
  for (const f of frags ?? []) {
    const fid = String(f.id);
    overlay.items.add(itemKey("fragment", fid));
    const { data: revId } = await supabase.rpc("fn_current_revision", {
      p_fragment_id: fid,
    });
    if (revId) {
      const rid = String(revId);
      overlay.items.add(itemKey("revision", rid));
      overlay.revisionByFragment.set(fid, rid);
    }
  }

  const characterIds = new Set<string>();
  const fragIds = (frags ?? []).map((f) => f.id);
  if (fragIds.length) {
    const { data: links } = await supabase
      .from("fragment_characters")
      .select("character_id, fragment_id")
      .in("fragment_id", fragIds);
    for (const link of links ?? []) {
      characterIds.add(String(link.character_id));
    }
  }
  for (const cid of characterIds) {
    overlay.items.add(itemKey("character", cid));
    const { data: ch } = await supabase
      .from("characters")
      .select("portrait_image_id")
      .eq("id", cid)
      .maybeSingle();
    if (ch?.portrait_image_id) {
      overlay.items.add(itemKey("image", String(ch.portrait_image_id)));
    }
  }

  const { data: groveCues } = await supabase
    .from("music_cues")
    .select("id")
    .eq("grove_id", groveId);
  for (const c of groveCues ?? []) {
    overlay.items.add(itemKey("music_cue", String(c.id)));
  }

  if (regionId) {
    const { data: zones } = await supabase
      .from("ambience_zones")
      .select("id")
      .eq("region_id", regionId);
    for (const z of zones ?? []) {
      overlay.items.add(itemKey("ambience_zone", String(z.id)));
    }
    const { data: profiles } = await supabase
      .from("ambience_profiles")
      .select("id")
      .eq("region_id", regionId);
    for (const p of profiles ?? []) {
      overlay.items.add(itemKey("ambience_profile", String(p.id)));
    }
    const { data: mzones } = await supabase
      .from("music_zones")
      .select("id")
      .eq("region_id", regionId);
    for (const z of mzones ?? []) {
      overlay.items.add(itemKey("music_zone", String(z.id)));
    }
    const zoneIds = (mzones ?? []).map((z) => z.id);
    if (zoneIds.length) {
      const { data: zoneCues } = await supabase
        .from("music_cues")
        .select("id")
        .in("music_zone_id", zoneIds);
      for (const c of zoneCues ?? []) {
        overlay.items.add(itemKey("music_cue", String(c.id)));
      }
    }
  }

  return overlay;
}
