/**
 * RC7: engine bus list must stay in sync with shared BUS_DEFAULT_DB (incl. moment).
 */
import { BUS_DEFAULT_DB, type BusId } from "@intell/shared";
import { ENGINE_BUS_IDS } from "./engineBuses";

describe("RNAudioApiEngine bus contract (RC7)", () => {
  it("ENGINE_BUS_IDS matches every shared BusId / BUS_DEFAULT_DB key", () => {
    const shared = Object.keys(BUS_DEFAULT_DB) as BusId[];
    expect([...ENGINE_BUS_IDS].sort()).toEqual([...shared].sort());
    expect(ENGINE_BUS_IDS).toContain("moment");
  });
});
