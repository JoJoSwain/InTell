#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { downloadManifestAssets } from "./download.mjs";

async function main(argv) {
  const archiveRoot = argv[0];
  if (!archiveRoot) {
    console.error(
      "Usage: node src/cli.mjs <unzipped-archive-folder>\n" +
        "Reads manifest.json and downloads assets into audio/ and images/.",
    );
    process.exitCode = 1;
    return;
  }

  const root = path.resolve(archiveRoot);
  const manifestPath = path.join(root, "manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (e) {
    console.error(
      `Could not read ${manifestPath}: ${e instanceof Error ? e.message : e}`,
    );
    process.exitCode = 1;
    return;
  }

  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  if (assets.length === 0) {
    console.log("No assets in manifest.json.");
    return;
  }

  const summary = await downloadManifestAssets(assets, root);
  console.log(
    `downloaded=${summary.downloaded} alreadyPresent=${summary.alreadyPresent} failed=${summary.failed.length}`,
  );
  for (const f of summary.failed) {
    console.error(`FAIL ${f.sha256}: ${f.reason}`);
  }
  if (summary.failed.length > 0) process.exitCode = 1;
}

main(process.argv.slice(2));
