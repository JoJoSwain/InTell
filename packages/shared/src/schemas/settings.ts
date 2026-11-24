import { z } from "zod";
import { BEACONS_ENABLED_DEFAULT } from "../audio/soundFeatures";

/** Shared device / Simulator settings defaults (A5). M7 wires the Settings page. */
export const DeviceAudioSettings = z
  .object({
    beaconsEnabled: z.boolean().default(BEACONS_ENABLED_DEFAULT),
    accessibleTrigger: z.boolean().optional(),
    locationAvailable: z.boolean().optional(),
  })
  .strict();

export type DeviceAudioSettings = z.infer<typeof DeviceAudioSettings>;
