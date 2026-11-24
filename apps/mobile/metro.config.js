const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");
const {
  resolveSpikeAudioRequest,
  SPIKE_WAV_NAMES,
} = require("./src/audio/spike/resolveSpikeAudioRequest");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const spikeRoot = path.join(projectRoot, "assets", "spike-audio");
const missingSpikeAsset = path.join(
  projectRoot,
  "src",
  "audio",
  "spike",
  "missingAsset.js",
);

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Custom resolveRequest breaks Metro asset ids for existing spike WAVs
// (context.resolveRequest skips Expo's asset pipeline). Only install it when
// at least one gitignored fixture is missing, so CI `expo export` still works.
const spikeFixturesPresent = SPIKE_WAV_NAMES.every((name) =>
  fs.existsSync(path.join(spikeRoot, name)),
);

if (!spikeFixturesPresent) {
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const spikeHit = resolveSpikeAudioRequest({
      originModulePath: context.originModulePath,
      moduleName,
      spikeRoot,
      missingSpikeAsset,
      existsSync: (p) => fs.existsSync(p),
    });
    if (spikeHit) {
      return spikeHit;
    }
    if (upstream) {
      return upstream(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
