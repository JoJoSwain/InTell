import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * @typedef {{
 *   sha256: string,
 *   ext: string,
 *   media: "audio" | "image" | string,
 *   url?: string,
 *   expiresAt?: string,
 * }} ManifestAsset
 */

/**
 * @typedef {{
 *   downloaded: number,
 *   alreadyPresent: number,
 *   failed: { sha256: string, reason: string }[],
 * }} DownloadSummary
 */

/** @param {string} expiresAt */
export function urlsExpired(expiresAt, nowMs = Date.now()) {
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= nowMs;
}

/** @param {Uint8Array | Buffer} bytes */
export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * @param {ManifestAsset} asset
 * @param {string} archiveRoot
 */
export function assetLocalPath(asset, archiveRoot) {
  const folder = asset.media === "image" ? "images" : "audio";
  const ext = (asset.ext || "bin").replace(/^\./, "");
  return path.join(archiveRoot, folder, `${asset.sha256}.${ext}`);
}

/**
 * @param {ManifestAsset[]} assets
 * @param {string} archiveRoot
 * @param {{
 *   nowMs?: number,
 *   fetchBytes?: (url: string) => Promise<{ ok: true, bytes: Uint8Array } | { ok: false, status: number, reason: string }>,
 *   readFile?: (p: string) => Promise<Buffer | null>,
 *   writeFile?: (p: string, bytes: Uint8Array) => Promise<void>,
 * }} [opts]
 * @returns {Promise<DownloadSummary>}
 */
export async function downloadManifestAssets(assets, archiveRoot, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const fetchBytes =
    opts.fetchBytes ??
    (async (url) => {
      const res = await fetch(url);
      if (!res.ok) {
        const expiredHint =
          res.status === 401 || res.status === 403
            ? " Signed URL may have expired — export again from the admin."
            : "";
        return {
          ok: false,
          status: res.status,
          reason: `HTTP ${res.status}.${expiredHint}`,
        };
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      return { ok: true, bytes: buf };
    });
  const readFile =
    opts.readFile ??
    (async (p) => {
      try {
        return await fs.readFile(p);
      } catch {
        return null;
      }
    });
  const writeFile =
    opts.writeFile ??
    (async (p, bytes) => {
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, bytes);
    });

  /** @type {DownloadSummary} */
  const summary = { downloaded: 0, alreadyPresent: 0, failed: [] };

  for (const asset of assets) {
    const dest = assetLocalPath(asset, archiveRoot);
    const existing = await readFile(dest);
    if (existing) {
      if (sha256Hex(existing) === asset.sha256.toLowerCase()) {
        summary.alreadyPresent += 1;
        continue;
      }
      summary.failed.push({
        sha256: asset.sha256,
        reason: `existing file at ${dest} has a different sha256`,
      });
      continue;
    }

    if (!asset.url) {
      summary.failed.push({
        sha256: asset.sha256,
        reason: "manifest has no url — re-export the archive",
      });
      continue;
    }

    if (asset.expiresAt && urlsExpired(asset.expiresAt, nowMs)) {
      summary.failed.push({
        sha256: asset.sha256,
        reason:
          "signed URL expired — export again from the admin, then re-run this tool",
      });
      continue;
    }

    const got = await fetchBytes(asset.url);
    if (!got.ok) {
      summary.failed.push({ sha256: asset.sha256, reason: got.reason });
      continue;
    }

    const digest = sha256Hex(got.bytes);
    if (digest !== asset.sha256.toLowerCase()) {
      summary.failed.push({
        sha256: asset.sha256,
        reason: `sha256 mismatch (got ${digest})`,
      });
      continue;
    }

    await writeFile(dest, got.bytes);
    summary.downloaded += 1;
  }

  return summary;
}
