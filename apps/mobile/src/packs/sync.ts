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
      if (installed && installed.version < entry.version) await args.install(entry);
    }
    const packs = await listPacks(args.db);
    const regions = regionIds(packs.filter((pack) => indexed.has(`${pack.scope}:${pack.id}`)));
    for (const entry of index) {
      if (entry.scope !== "region") continue;
      const installed = packs.find((pack) => pack.scope === entry.scope && pack.id === entry.id);
      const needed = regions.has(entry.id);
      if (installed && installed.version < entry.version) await args.install(entry);
      else if (!installed && needed) await args.install(entry);
    }
  }

  for (const pack of await listPacks(args.db)) {
    if (!indexed.has(`${pack.scope}:${pack.id}`)) await deletePack(args.db, pack.scope, pack.id);
  }

  const kept = (await listPacks(args.db)).map((pack) => storedManifest(pack));
  const local = await listAssets(args.db);
  const drop = assetsToDelete(
    local.map((asset) => asset.sha),
    kept,
  );
  for (const sha of drop) {
    const row = await getAsset(args.db, sha);
    if (row) await args.files.delete(row.local_uri);
    await deleteAsset(args.db, sha);
  }
}

function storedManifest(pack: PackRow): PackManifest {
  const parsed: unknown = JSON.parse(pack.manifest_json);
  return pack.scope === "region" ? RegionPack.parse(parsed) : GrovePack.parse(parsed);
}

function regionIds(packs: readonly PackRow[]): Set<string> {
  const ids = new Set<string>();
  for (const pack of packs) {
    if (pack.scope !== "grove") continue;
    const manifest = storedManifest(pack);
    if (manifest.schema === 3) ids.add(manifest.regionId);
  }
  return ids;
}
