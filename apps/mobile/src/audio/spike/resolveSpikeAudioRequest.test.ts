import path from "path";

// CommonJS helper used by metro.config.js (keep require for the same module shape).
const {
  resolveSpikeAudioRequest,
} = require("./resolveSpikeAudioRequest") as {
  resolveSpikeAudioRequest: (args: {
    originModulePath: string | undefined;
    moduleName: string;
    spikeRoot: string;
    missingSpikeAsset: string;
    existsSync: (p: string) => boolean;
  }) => { type: "sourceFile"; filePath: string } | null;
};

const projectRoot = path.resolve("/fake-intell-mobile");
const spikeRoot = path.join(projectRoot, "assets", "spike-audio");
const missingSpikeAsset = path.join(
  projectRoot,
  "src",
  "audio",
  "spike",
  "missingAsset.js",
);
const origin = path.join(projectRoot, "src", "audio", "spike", "assets.ts");
const moduleName = "../../../assets/spike-audio/narration_90s.wav";
const absWav = path.resolve(path.dirname(origin), moduleName);

test("missing spike WAV resolves to the sentinel module", () => {
  const hit = resolveSpikeAudioRequest({
    originModulePath: origin,
    moduleName,
    spikeRoot,
    missingSpikeAsset,
    existsSync: () => false,
  });
  expect(hit).toEqual({ type: "sourceFile", filePath: missingSpikeAsset });
});

test("existing spike WAV falls through (null) for the upstream resolver", () => {
  const hit = resolveSpikeAudioRequest({
    originModulePath: origin,
    moduleName,
    spikeRoot,
    missingSpikeAsset,
    existsSync: (p) => p === absWav,
  });
  expect(hit).toBeNull();
});

test("non-spike modules fall through", () => {
  const hit = resolveSpikeAudioRequest({
    originModulePath: origin,
    moduleName: "./fixturesReady",
    spikeRoot,
    missingSpikeAsset,
    existsSync: () => true,
  });
  expect(hit).toBeNull();
});
