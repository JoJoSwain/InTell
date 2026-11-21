import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseM4aAudioParams } from "./container";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "minimal-mp4a.m4a",
);

describe("parseM4aAudioParams", () => {
  it("reads channels=1 and sampleRate=44100 from minimal-mp4a.m4a", () => {
    const bytes = new Uint8Array(readFileSync(fixturePath));
    expect(parseM4aAudioParams(bytes)).toEqual({
      channels: 1,
      sampleRate: 44100,
    });
  });

  it("returns null for empty / non-mp4 input", () => {
    expect(parseM4aAudioParams(new Uint8Array())).toBeNull();
    expect(parseM4aAudioParams(new Uint8Array([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70]))).toBeNull();
  });
});
