import { GrovePack, RegionPack, type PackIndexEntry, type PackManifest } from "@intell/shared";
import type { SqlDriver } from "../db/driver";
import { deleteAsset, deletePack, getAsset, listAssets, listPacks, type PackRow } from "../db/repos";
import type { FileStore } from "../files/store";
import { decideDownload, type Transport } from "./policy";
import { assetsToDelete } from "./syncDiff";

export async function syncContent(args: {
  transport: Transport;
  confirmCellular: () => Promise<boolean>;
  fetchIndex: () => Promise<PackIndexEntry[]>;
  install: (entry: PackIndexEntry) => Promise<void>;
  db: SqlDriver;
  files: FileStore;
}): Promise<void> {
  if (args.transport === "none") return;
  const allowDownload = await decideDownload(args.transport, args.confirmCellular);
  const index = await args.fetchIndex();
  const indexed = new Map(index.map((entry) => [`${entry.scope}:${entry.id}`, entry]));

  if (allowDownload) {
    for (const entry of index) {
      if (entry.scope !== "grove") continue;
      const installed = (await listPacks(args.db)).find(
        (pack) => pack.scope === entry.scope && pack.id === entry.id,
      );
      if (installed && installedVersion(installed) < entry.version) await args.install(entry);
    }
    const packs = await listPacks(args.db);
    const regions = regionIds(packs.filter((pack) => indexed.has(`${pack.scope}:${pack.id}`)));
    for (const entry of index) {
      if (entry.scope !== "region") continue;
      const installed = packs.find((pack) => pack.scope === entry.scope && pack.id === entry.id);
      const needed = regions.has(entry.id);
      if (installed && installedVersion(installed) < entry.version) await args.install(entry);
      else if (!installed && needed) await args.install(entry);
    }
  }

  for (const pack of await listPacks(args.db)) {
    if (!indexed.has(`${pack.scope}:${pack.id}`)) await deletePack(args.db, pack.scope, pack.id);
  }

  const kept: PackManifest[] = [];
  const rawKeep = new Set<string>();
  for (const pack of await listPacks(args.db)) {
    const parsed = parsedManifest(pack);
    if (parsed) kept.push(parsed);
    else for (const sha of rawAssetShas(pack)) rawKeep.add(sha);
  }
  const local = await listAssets(args.db);
  const drop = assetsToDelete(
    local.map((asset) => asset.sha),
    kept,
  ).filter((sha) => !rawKeep.has(sha));
  for (const sha of drop) {
    const row = await getAsset(args.db, sha);
    if (row) await args.files.delete(row.local_uri);
    await deleteAsset(args.db, sha);
  }
}

function rawObject(pack: PackRow): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(pack.manifest_json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parsedManifest(pack: PackRow): PackManifest | null {
  const raw = rawObject(pack);
  if (!raw) return null;
  const result = pack.scope === "region" ? RegionPack.safeParse(raw) : GrovePack.safeParse(raw);
  return result.success ? result.data : null;
}

/** A manifest that no longer parses is reinstalled on the next sync. */
function installedVersion(pack: PackRow): number {
  return parsedManifest(pack) ? pack.version : 0;
}

function rawAssetShas(pack: PackRow): string[] {
  const assets = rawObject(pack)?.assets;
  if (!Array.isArray(assets)) return [];
  const shas: string[] = [];
  for (const asset of assets) {
    if (!asset || typeof asset !== "object" || !("sha" in asset)) continue;
    const sha = asset.sha;
    if (typeof sha === "string") shas.push(sha);
  }
  return shas;
}

function regionIds(packs: readonly PackRow[]): Set<string> {
  const ids = new Set<string>();
  for (const pack of packs) {
    if (pack.scope !== "grove") continue;
    const regionId = rawObject(pack)?.regionId;
    if (typeof regionId === "string" && regionId.length > 0) ids.add(regionId);
  }
  return ids;
}
