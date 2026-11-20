import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sha256Hex } from "./digest.ts";
import { asPolygon, pointLatLng } from "./geo.ts";
import { persistPackIfChanged, type PackPersistResult } from "./packPersist.ts";

function maxTs(values: (string | null | undefined)[]): string {
  let best = "1970-01-01T00:00:00.000Z";
  for (const v of values) {
    if (!v) continue;
    const iso = new Date(v).toISOString();
    if (iso > best) best = iso;
  }
  return best;
}

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

export async function buildGrovePackObject(
  supabase: SupabaseClient,
  groveId: string,
  packVersion: number,
): Promise<{ pack: Record<string, unknown>; contentBody: Record<string, unknown>; watermarks: string[] }> {
  const watermarks: string[] = [];

  const { data: grove, error: gErr } = await supabase
    .from("groves")
    .select(
      "id, name, premise, access_notes, boundary, pack_version, updated_at, site_id, narrator_growth_cue_id, status",
    )
    .eq("id", groveId)
    .single();
  if (gErr || !grove) throw new Error(`grove not found: ${gErr?.message}`);
  watermarks.push(grove.updated_at);

  const { data: boundaryGeo, error: bErr } = await supabase.rpc(
    "fn_pack_geog_geojson",
    { p_scope: "grove_boundary", p_id: groveId },
  );
  if (bErr || !boundaryGeo) {
    throw new Error(`grove boundary geojson: ${bErr?.message ?? "null"}`);
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, access_info, website_url, gatherings_url, updated_at")
    .eq("id", grove.site_id)
    .single();
  if (site?.updated_at) watermarks.push(site.updated_at);

  const { data: rings } = await supabase
    .from("rings")
    .select("*")
    .eq("grove_id", groveId);
  for (const r of rings ?? []) watermarks.push(r.updated_at);

  const { data: characters } = await supabase
    .from("characters")
    .select("*")
    .eq("grove_id", groveId);

  const { data: fragments } = await supabase
    .from("fragments")
    .select("*, marker_code, location")
    .eq("grove_id", groveId)
    .in("status", ["published", "retired"]);

  const fragIds = (fragments ?? []).map((f) => f.id);

  const { data: groups } = fragIds.length
    ? await supabase
        .from("fragment_prereq_groups")
        .select("id, fragment_id, sort_order")
        .in("fragment_id", fragIds)
    : { data: [] as { id: string; fragment_id: string; sort_order: number }[] };

  const groupIds = (groups ?? []).map((g) => g.id);
  const { data: members } = groupIds.length
    ? await supabase
        .from("fragment_prereq_members")
        .select("group_id, requires_fragment_id, sort_order")
        .in("group_id", groupIds)
    : { data: [] as { group_id: string; requires_fragment_id: string; sort_order: number }[] };

  const { data: threads } = fragIds.length
    ? await supabase.from("fragment_threads").select("*").in("fragment_id", fragIds)
    : { data: [] as { fragment_id: string; thread_id: string }[] };
  const { data: fragChars } = fragIds.length
    ? await supabase.from("fragment_characters").select("*").in("fragment_id", fragIds)
    : { data: [] as { fragment_id: string; character_id: string }[] };

  // Playable revisions
  const { data: allRevs } = fragIds.length
    ? await supabase.from("fragment_revisions").select("*").in("fragment_id", fragIds)
    : { data: [] as Record<string, unknown>[] };

  const playableRevs: Record<string, unknown>[] = [];
  for (const rev of allRevs ?? []) {
    const { data: ok } = await supabase.rpc("fn_revision_is_playable", {
      p_revision_id: rev.id,
    });
    if (ok) {
      playableRevs.push(rev);
      watermarks.push(String(rev.updated_at ?? ""));
    }
  }

  const revIds = playableRevs.map((r) => String(r.id));
  const { data: versions } = revIds.length
    ? await supabase.from("revision_versions").select("*").in("revision_id", revIds)
    : { data: [] as Record<string, unknown>[] };
  const { data: revCreds } = revIds.length
    ? await supabase
        .from("revision_contributors")
        .select("revision_id, role, contributor_id, consent_id")
        .in("revision_id", revIds)
    : { data: [] as Record<string, unknown>[] };

  const contributorIds = [
    ...new Set((revCreds ?? []).map((c) => String(c.contributor_id))),
  ];
  const { data: contributors } = contributorIds.length
    ? await supabase
        .from("contributors")
        .select("id, display_credit")
        .in("id", contributorIds)
    : { data: [] as { id: string; display_credit: string }[] };
  const creditById = Object.fromEntries(
    (contributors ?? []).map((c) => [c.id, c.display_credit]),
  );

  const assetIds = [
    ...new Set(
      (versions ?? [])
        .map((v) => String(v.narration_asset_id))
        .filter(Boolean),
    ),
  ];

  const currentByFrag: Record<string, string> = {};
  for (const fid of fragIds) {
    const { data: cur } = await supabase.rpc("fn_current_revision", {
      p_fragment_id: fid,
    });
    if (cur) currentByFrag[fid] = cur as string;
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("grove_id", groveId);
  const { data: crossroads } = await supabase
    .from("crossroads")
    .select("*")
    .eq("grove_id", groveId);
  const xrIds = (crossroads ?? []).map((c) => c.id);
  const { data: options } = xrIds.length
    ? await supabase.from("crossroads_options").select("*").in("crossroads_id", xrIds)
    : { data: [] as Record<string, unknown>[] };

  const { data: cues } = await supabase
    .from("music_cues")
    .select("*")
    .eq("grove_id", groveId)
    .eq("status", "published");
  const playableCues = [];
  for (const cue of cues ?? []) {
    const { data: ok } = await supabase.rpc("fn_cue_is_playable", { p_cue_id: cue.id });
    if (ok) playableCues.push(cue);
  }
  const cueIds = playableCues.map((c) => c.id);
  const { data: stems } = cueIds.length
    ? await supabase.from("music_cue_stems").select("*").in("cue_id", cueIds)
    : { data: [] as Record<string, unknown>[] };
  for (const s of stems ?? []) assetIds.push(String(s.asset_id));

  // Ambience zones intersecting grove bbox + 1km — simplify: all region zones
  const { data: groveSite } = await supabase
    .from("sites")
    .select("region_id")
    .eq("id", grove.site_id)
    .single();
  const regionId = groveSite?.region_id;
  const { data: ambZones } = regionId
    ? await supabase
        .from("ambience_zones")
        .select("*, ambience_profiles(slug)")
        .eq("region_id", regionId)
        .eq("status", "published")
    : { data: [] as Record<string, unknown>[] };

  const { data: assets } = assetIds.length
    ? await supabase.from("audio_assets").select("*").in("id", [...new Set(assetIds)])
    : { data: [] as Record<string, unknown>[] };
  const assetById = Object.fromEntries((assets ?? []).map((a) => [a.id, a]));

  // Fragment locations via helper
  const fragPack = [];
  for (const f of sortById(
    [...(fragments ?? [])].sort(
      (a, b) =>
        (a.story_order ?? 0) - (b.story_order ?? 0) ||
        String(a.id).localeCompare(String(b.id)),
    ),
  )) {
    watermarks.push(f.updated_at);
    const fGroups = (groups ?? [])
      .filter((g) => g.fragment_id === f.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    const requires: string[][] = fGroups.map((g) =>
      (members ?? [])
        .filter((m) => m.group_id === g.id)
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            a.requires_fragment_id.localeCompare(b.requires_fragment_id),
        )
        .map((m) => m.requires_fragment_id),
    );

    const entry: Record<string, unknown> = {
      id: f.id,
      tier: f.tier,
      isEnding: !!f.is_ending,
      requires,
      title: f.title,
      visibility: f.visibility,
      storyOrder: f.story_order,
      gapHint: f.gap_hint ?? undefined,
      retired: f.status === "retired",
      threadIds: (threads ?? [])
        .filter((t) => t.fragment_id === f.id)
        .map((t) => t.thread_id)
        .sort(),
      characterIds: (fragChars ?? [])
        .filter((t) => t.fragment_id === f.id)
        .map((t) => t.character_id)
        .sort(),
    };

    if (f.visibility === "protected") {
      if (f.marker_code) {
        entry.markerHash = await sha256Hex(String(f.marker_code));
      }
    } else {
      const { data: pt } = await supabase.rpc("fn_pack_geog_geojson", {
        p_scope: "fragment_point",
        p_id: f.id,
      });
      const { lat, lng } = pointLatLng(pt);
      entry.lat = lat;
      entry.lng = lng;
      entry.radiusM = f.trigger_radius_m;
    }
    fragPack.push(entry);
  }

  const revPack = [];
  for (const rev of [...playableRevs].sort(
    (a, b) =>
      String(a.fragment_id).localeCompare(String(b.fragment_id)) ||
      Number(a.revision_no) - Number(b.revision_no),
  )) {
    const vers = (versions ?? [])
      .filter((v) => v.revision_id === rev.id)
      .sort((a, b) =>
        String(a.language ?? a.lang).localeCompare(String(b.language ?? b.lang)),
      );
    const credits = (revCreds ?? [])
      .filter((c) => c.revision_id === rev.id)
      .map((c) => ({
        display: creditById[String(c.contributor_id)] ?? "Unknown",
        role: String(c.role),
      }))
      .sort((a, b) => a.display.localeCompare(b.display) || a.role.localeCompare(b.role));

    const { count } = await supabase
      .from("seed_links")
      .select("*", { count: "exact", head: true })
      .eq("revision_id", rev.id)
      .eq("stage", "grown");

    revPack.push({
      id: rev.id,
      fragmentId: rev.fragment_id,
      revisionNo: rev.revision_no,
      ringId: rev.ring_id,
      publishAt: new Date(String(rev.publish_at)).toISOString(),
      contentNote: rev.content_note ?? undefined,
      changeNote: rev.change_note ?? undefined,
      versions: vers.map((v) => {
        const asset = assetById[String(v.narration_asset_id)];
        return {
          lang: String(v.language ?? v.lang),
          assetSha: asset?.sha256,
          durationMs: asset?.duration_ms,
          bytes: asset?.bytes,
          transcript: v.transcript,
          ...(v.vtt ? { vtt: v.vtt } : {}),
        };
      }),
      credits,
      grownFromSeedCount: count ?? 0,
    });
  }

  const musicCuesPack = [];
  for (const cue of sortById(playableCues)) {
    const cueStems = (stems ?? [])
      .filter((s) => s.cue_id === cue.id)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const packed: Record<string, unknown> = {
      id: cue.id,
      useGroveBoundary: !!cue.grove_id && !cue.music_zone_id,
      priority: cue.priority,
      conditions: cue.conditions ?? {},
      minDwellS: cue.min_dwell_s,
      crossfadeMs: cue.crossfade_ms,
      stems: cueStems.map((s) => {
        const asset = assetById[String(s.asset_id)];
        const rules = Array.isArray(s.state_gains) ? s.state_gains : [];
        return {
          assetSha: asset?.sha256,
          role: s.role,
          gainDb: s.gain_db,
          stateGains: rules.map((r: { when?: unknown; gain_db?: number; gainDb?: number }) => ({
            when: r.when ?? {},
            gainDb: r.gainDb ?? r.gain_db ?? 0,
          })),
          loopStartMs: asset?.loop_start_ms ?? null,
          loopEndMs: asset?.loop_end_ms ?? null,
        };
      }),
    };
    musicCuesPack.push(packed);
  }

  const ambPack = [];
  for (const z of sortById(ambZones ?? [])) {
    const { data: bj } = await supabase.rpc("fn_pack_geog_geojson", {
      p_scope: "ambience_zone",
      p_id: z.id,
    });
    ambPack.push({
      id: z.id,
      boundary: asPolygon(bj),
      profileSlug: (z.ambience_profiles as { slug?: string } | null)?.slug ?? "",
      priority: z.priority,
      edgeFadeM: z.edge_fade_m,
    });
  }

  const ledger = [];
  for (const ring of sortById(rings ?? [])) {
    const { data: seeds } = await supabase
      .from("seeds")
      .select("credit_name, credit_status, status, planted_at")
      .eq("ring_id", ring.id);
    const grown = (seeds ?? []).filter((s) => s.status === "grown");
    const approved = grown
      .filter((s) => s.credit_status === "approved" && s.credit_name)
      .sort(
        (a, b) =>
          new Date(a.planted_at).getTime() - new Date(b.planted_at).getTime(),
      );
    const growers = [...new Set(approved.map((s) => String(s.credit_name)))];
    const anonymousCount = grown.filter(
      (s) => s.credit_status !== "approved" || !s.credit_name,
    ).length;
    ledger.push({
      ringId: ring.id,
      growers,
      anonymousCount,
      seedsPlanted: (seeds ?? []).length,
      seedsGrown: grown.length,
    });
  }

  const assetList = [...(assets ?? [])]
    .map((a) => ({
      sha: a.sha256,
      ext: a.ext,
      bytes: a.bytes,
      kind: a.kind,
    }))
    .sort((a, b) => a.sha.localeCompare(b.sha));

  let growthCueAssetSha: string | undefined;
  if (grove.narrator_growth_cue_id) {
    const { data: ga } = await supabase
      .from("audio_assets")
      .select("sha256")
      .eq("id", grove.narrator_growth_cue_id)
      .maybeSingle();
    if (ga?.sha256) growthCueAssetSha = ga.sha256;
  }

  const builtAt = maxTs(watermarks);
  const pack: Record<string, unknown> = {
    schema: 1,
    groveId,
    packVersion,
    builtAt,
    grove: {
      id: grove.id,
      name: grove.name,
      premise: grove.premise,
      accessNotes: grove.access_notes ?? undefined,
      boundary: asPolygon(boundaryGeo),
      site: {
        name: site?.name ?? "",
        accessInfo: site?.access_info ?? undefined,
        websiteUrl: site?.website_url ?? undefined,
        gatheringsUrl: site?.gatherings_url ?? undefined,
      },
      ...(growthCueAssetSha ? { growthCueAssetSha } : {}),
    },
    rings: sortById(rings ?? []).map((r) => ({
      id: r.id,
      ringNo: r.ring_no,
      name: r.name,
      themeNote: r.theme_note ?? undefined,
      status: r.status,
      plantingOpensAt: r.planting_opens_at
        ? new Date(r.planting_opens_at).toISOString()
        : undefined,
      plantingClosesAt: r.planting_closes_at
        ? new Date(r.planting_closes_at).toISOString()
        : undefined,
      releasedAt: r.released_at
        ? new Date(r.released_at).toISOString()
        : undefined,
    })),
    characters: sortById(characters ?? []).map((c) => ({
      id: c.id,
      publicName: c.public_name,
      publicBio: c.public_bio ?? undefined,
      introducedByFragmentIds: [],
    })),
    fragments: fragPack,
    revisions: revPack,
    currentRevisionByFragment: Object.fromEntries(
      Object.entries(currentByFrag).sort(([a], [b]) => a.localeCompare(b)),
    ),
    questions: sortById(questions ?? []).map((q) => ({
      id: q.id,
      ringId: q.ring_id,
      text: q.text,
      ...(q.anchor_fragment_id
        ? { anchorFragmentId: q.anchor_fragment_id }
        : {}),
      ...(q.anchor_character_id
        ? { anchorCharacterId: q.anchor_character_id }
        : {}),
      requiresHeard: q.requires_heard,
      opensAt: q.opens_at ? new Date(q.opens_at).toISOString() : undefined,
      closesAt: q.closes_at ? new Date(q.closes_at).toISOString() : undefined,
    })),
    crossroads: sortById(crossroads ?? []).map((c) => {
      const opts = (options ?? [])
        .filter((o) => o.crossroads_id === c.id)
        .sort(
          (a, b) =>
            Number(a.sort_order) - Number(b.sort_order) ||
            String(a.id).localeCompare(String(b.id)),
        );
      const row: Record<string, unknown> = {
        id: c.id,
        ringId: c.ring_id,
        anchorFragmentId: c.anchor_fragment_id,
        prompt: c.prompt,
        voteRadiusM: c.vote_radius_m,
        opensAt: new Date(c.opens_at).toISOString(),
        closesAt: new Date(c.closes_at).toISOString(),
        status: c.status,
        options: opts.map((o) => ({
          id: o.id,
          label: o.label,
          description: o.description ?? undefined,
        })),
      };
      if (c.status === "decided" && c.outcome_option_id) {
        row.outcome = {
          optionId: c.outcome_option_id,
          note: c.outcome_note ?? undefined,
        };
      }
      return row;
    }),
    music: { cues: musicCuesPack },
    ambienceZones: ambPack,
    ledger,
    gatherings: [],
    assets: assetList,
  };

  const { packVersion: _pv, builtAt: _ba, ...contentBody } = pack;
  void _pv;
  void _ba;

  return { pack, contentBody, watermarks };
}

/** Build and persist grove pack (R4 no-op via content_sha256). */
export async function buildGrovePack(
  supabase: SupabaseClient,
  groveId: string,
  reason?: string,
): Promise<PackPersistResult> {
  const { pack } = await buildGrovePackObject(supabase, groveId, 0);
  const assets = (pack.assets as { sha: string; bytes: number }[]) ?? [];
  return persistPackIfChanged(supabase, {
    scope: "grove",
    scopeId: groveId,
    body: pack,
    assetShas: assets.map((a) => String(a.sha).toLowerCase()),
    bytesTotal: assets.reduce((n, a) => n + (a.bytes ?? 0), 0),
    reason,
  });
}
