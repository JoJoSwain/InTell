import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const revalidatePath = vi.fn();
const createClient = vi.fn();
const loadStaff = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...(args as [string])),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));
vi.mock("@/lib/staff", async () => {
  const actual = await vi.importActual<typeof import("@/lib/staff")>(
    "@/lib/staff",
  );
  return {
    ...actual,
    loadStaff: (...args: unknown[]) => loadStaff(...args),
  };
});

import {
  saveAmbienceProfile,
  saveAmbienceZone,
  saveGroveSoundCues,
  saveLayerAssetWeights,
  saveMusicCue,
  saveMusicCueStems,
} from "./actions";

function fd(entries: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) {
      for (const item of v) form.append(k, item);
    } else {
      form.set(k, v);
    }
  }
  return form;
}

function soundStaff() {
  return {
    user_id: "user-1",
    display_name: "S",
    role: "sound" as const,
    active: true,
  };
}

function clientWithAuth(extra: {
  from?: unknown;
  rpc?: unknown;
}) {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
    },
    from: extra.from ?? vi.fn(),
    rpc: extra.rpc ?? vi.fn(),
  };
}

describe("sound actions auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anon to sign-in", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
      from: vi.fn(),
      rpc: vi.fn(),
    });
    loadStaff.mockResolvedValue(null);
    await expect(saveAmbienceProfile(fd({ id: "p1" }))).rejects.toThrow(
      /REDIRECT:\/sign-in/,
    );
  });

  it("refuses non-sound staff (viewer)", async () => {
    createClient.mockResolvedValue(clientWithAuth({}));
    loadStaff.mockResolvedValue({
      user_id: "user-1",
      display_name: "V",
      role: "viewer",
      active: true,
    });
    const result = await saveAmbienceProfile(fd({ id: "p1", density: "1" }));
    expect(result).toEqual({
      ok: false,
      error: "sound, editor or admin required",
    });
  });

  it("refuses inactive staff", async () => {
    createClient.mockResolvedValue(clientWithAuth({}));
    loadStaff.mockResolvedValue({
      user_id: "user-1",
      display_name: "X",
      role: "viewer",
      active: false,
    });
    const result = await saveMusicCueStems(fd({ cue_id: "c1" }));
    expect(result).toEqual({
      ok: false,
      error: "sound, editor or admin required",
    });
  });
});

describe("sound actions validation (mocked supabase)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadStaff.mockResolvedValue(soundStaff());
  });

  it("rejects invalid zone GeoJSON before rpc", async () => {
    const rpc = vi.fn();
    createClient.mockResolvedValue(
      clientWithAuth({
        rpc,
        from: () => ({
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      }),
    );

    const result = await saveAmbienceZone(
      fd({
        id: "z1",
        name: "Zone",
        priority: "1",
        edge_fade_m: "5",
        boundary: '{"type":"Point","coordinates":[0,0]}',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Polygon/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses more than 4 stems", async () => {
    createClient.mockResolvedValue(clientWithAuth({}));

    const result = await saveMusicCueStems(
      fd({
        cue_id: "c1",
        stem_asset_id: ["a1", "a2", "a3", "a4", "a5"],
        stem_id: ["", "", "", "", ""],
        stem_role: ["s", "s", "s", "s", "s"],
        stem_gain_db: ["0", "0", "0", "0", "0"],
        stem_state_gains_json: ["[]", "[]", "[]", "[]", "[]"],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/STEMS_OVER_MAX/);
  });

  it("refuses mono bed weights as BED_MONO", async () => {
    const chain = {
      select: () => ({
        in: async () => ({
          data: [{ id: "bed1", kind: "sfx_bed", channels: 1 }],
          error: null,
        }),
      }),
      delete: () => ({
        eq: async () => ({ error: null }),
      }),
      insert: async () => ({ error: null }),
    };
    createClient.mockResolvedValue(clientWithAuth({ from: () => chain }));

    const result = await saveLayerAssetWeights(
      fd({
        layer_id: "l1",
        profile_id: "p1",
        asset_id: "bed1",
        weight: "1",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/BED_MONO/);
  });

  it("refuses wrong asset kind on grove cues", async () => {
    const from = (table: string) => {
      if (table === "groves") {
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      if (table === "audio_assets") {
        return {
          select: () => ({
            in: async () => ({
              data: [{ id: "a1", kind: "sfx_oneshot" }],
              error: null,
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        }),
      };
    };
    createClient.mockResolvedValue(clientWithAuth({ from }));

    const result = await saveGroveSoundCues(
      fd({
        grove_id: "g1",
        depth_bloom_texture_m: "15",
        asset_beacon_root: "a1",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/beacon/);
  });

  it("refuses unknown heardAll fragment ids on music cues", async () => {
    const missing = "bbbbbbbb-bbbb-4ccc-8ddd-000000000099";
    let musicCueSelects = 0;
    const from = (table: string) => {
      if (table === "music_cues") {
        musicCueSelects += 1;
        if (musicCueSelects === 1) {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "c1",
                    grove_id: "g1",
                    time_window: "day",
                    conditions: {},
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [{ id: "c1", conditions: {} }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "fragments") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }
      return {};
    };
    createClient.mockResolvedValue(clientWithAuth({ from }));

    const result = await saveMusicCue(
      fd({
        id: "c1",
        name: "Cue",
        conditions_json: JSON.stringify({ heardAll: [missing] }),
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/does not exist/);
  });
});
