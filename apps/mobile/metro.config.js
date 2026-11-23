const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

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

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (context.originModulePath) {
    const abs = path.isAbsolute(moduleName)
      ? moduleName
      : path.resolve(path.dirname(context.originModulePath), moduleName);
    const rel = path.relative(spikeRoot, abs);
    const insideSpike = rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
    if (insideSpike && !fs.existsSync(abs)) {
      return { type: "sourceFile", filePath: missingSpikeAsset };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
