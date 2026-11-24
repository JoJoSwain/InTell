import { describe, expect, it } from "vitest";
import { TRANSIENT_CREST_DB, measureLoudness } from "@intell/shared";

describe("N3 loudness + crest", () => {
  it("measureLoudness returns crestFactorDb used for TRANSIENT", () => {
    const sr = 48_000;
    const n = sr * 2;
    const ch = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      ch[i] = 0.1 * Math.sin((2 * Math.PI * 1000 * i) / sr);
    }
    // Spike for high crest
    ch[sr] = 0.99;
    const r = measureLoudness([ch], sr);
    expect(Number.isFinite(r.crestFactorDb)).toBe(true);
    expect(r.crestFactorDb).toBeGreaterThan(TRANSIENT_CREST_DB);
  });
});
