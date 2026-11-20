/**
 * Metro asset module ids for spike WAVs.
 * Files must exist on disk (run the fixture generator) or Metro will fail to resolve.
 */
export const SPIKE_ASSET_MODULES = {
  narration: require("../../../assets/spike-audio/narration_90s.wav"),
  stemA: require("../../../assets/spike-audio/stem_a.wav"),
  stemB: require("../../../assets/spike-audio/stem_b.wav"),
  stemC: require("../../../assets/spike-audio/stem_c.wav"),
  bedWind: require("../../../assets/spike-audio/bed_wind.wav"),
  bedWater: require("../../../assets/spike-audio/bed_water.wav"),
  oneshot1: require("../../../assets/spike-audio/oneshot_1.wav"),
  oneshot2: require("../../../assets/spike-audio/oneshot_2.wav"),
  oneshot3: require("../../../assets/spike-audio/oneshot_3.wav"),
  oneshot4: require("../../../assets/spike-audio/oneshot_4.wav"),
  oneshot5: require("../../../assets/spike-audio/oneshot_5.wav"),
  oneshot6: require("../../../assets/spike-audio/oneshot_6.wav"),
} as const;

export type SpikeAssetKey = keyof typeof SPIKE_ASSET_MODULES;
