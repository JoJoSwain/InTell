/**
 * Bus ids the mobile engine must create — mirrors shared BUS_DEFAULT_DB (RC7).
 * Kept in a jest-loadable module (RNAudioApiEngine pulls native audio).
 */
import { BUS_DEFAULT_DB, type BusId } from "@intell/shared";

export const ENGINE_BUS_IDS = Object.keys(BUS_DEFAULT_DB) as BusId[];
