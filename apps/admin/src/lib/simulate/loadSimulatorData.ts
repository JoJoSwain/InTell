"use server";

import { GrovePack, RegionPack } from "@intell/shared";
import { createClient } from "@/lib/supabase/server";
import { callEdgeFunction } from "@/lib/edge";
import {
  canViewSound,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import {
  demoWorldFallback,
  worldFromPacks,
  type SimulatorAssetUrl,
  type WorldFromPacksResult,
} from "./worldFromPacks";

export type SimulatorLoadResult =
  | {
      ok: true;
      mode: "pack" | "demo";
      packError: string | null;
      worldJson: ReturnType<typeof serializeWorld>;
      origin: { lat: number; lng: number };
      breathByFragment: Record<string, number[]>;
      swellByFragment: Record<string, number[]>;
      assets: SimulatorAssetUrl[];
    }
  | { ok: false; error: string };

function serializeWorld(result: WorldFromPacksResult) {
  return {
    groveId: result.world.groveId,
    fragments: result.world.fragments,
    cues: result.world.cues.map((c) => ({
      ...c,
      // boundary is JSON-safe
    })),
    ambienceZones: result.world.ambienceZones,
    profiles: result.world.profiles,
    classToProfile: [...result.world.classToProfile.entries()],
    landcoverCells: result.world.landcoverCells,
    motifDaySha: result.world.motifDaySha ?? null,
    motifNightSha: result.world.motifNightSha ?? null,
    depthBloomTextureM: result.world.depthBloomTextureM,
    allowsSpeakerWildlife: result.world.allowsSpeakerWildlife,
    hushIntervalMin: result.world.hushIntervalMin,
  };
}

export async function loadSimulatorData(
  groveId: string,
): Promise<SimulatorLoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "sign in required" };
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewSound(staff.role)) {
    return { ok: false, error: "sound view required" };
  }

  const result = await callEdgeFunction(supabase, "preview", { groveId });
  if (!result.ok) {
    const demo = demoWorldFallback(groveId);
    return {
      ok: true,
      mode: "demo",
      packError: result.error,
      worldJson: serializeWorld(demo),
      origin: demo.origin,
      breathByFragment: demo.breathByFragment,
      swellByFragment: demo.swellByFragment,
      assets: [],
    };
  }

  const data = result.data as {
    schema?: string;
    grove?: unknown;
    region?: unknown;
    assets?: SimulatorAssetUrl[];
    error?: string;
  };

  try {
    // Strict schemas (reuse pack validators)
    GrovePack.parse(data.grove);
    RegionPack.parse(data.region);
    const loaded = worldFromPacks({
      grove: data.grove,
      region: data.region,
      assets: data.assets ?? [],
    });
    if (loaded.empty) {
      const demo = demoWorldFallback(groveId);
      return {
        ok: true,
        mode: "demo",
        packError: "Grove has no fragments yet — showing demo world.",
        worldJson: serializeWorld(demo),
        origin: demo.origin,
        breathByFragment: demo.breathByFragment,
        swellByFragment: demo.swellByFragment,
        assets: [],
      };
    }
    return {
      ok: true,
      mode: "pack",
      packError: null,
      worldJson: serializeWorld(loaded),
      origin: loaded.origin,
      breathByFragment: loaded.breathByFragment,
      swellByFragment: loaded.swellByFragment,
      assets: data.assets ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const demo = demoWorldFallback(groveId);
    return {
      ok: true,
      mode: "demo",
      packError: `Pack schema: ${message}`,
      worldJson: serializeWorld(demo),
      origin: demo.origin,
      breathByFragment: demo.breathByFragment,
      swellByFragment: demo.swellByFragment,
      assets: [],
    };
  }
}
