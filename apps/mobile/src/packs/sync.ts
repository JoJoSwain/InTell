import type { PackIndexEntry } from "@intell/shared";
import type { SqlDriver } from "../db/driver";
import { deleteAsset, deletePack, getAsset, listAssets, listPacks } from "../db/repos";
import type { FileStore } from "../files/store";
import { decideDownload, type Transport } from "./policy";
import { assetsToDelete, manifestShas } from "./syncDiff";

type ManifestShape = { assets?: { sha: string }[] };

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
      const installed = (await listPacks(args.db)).find(
        (pack) => pack.scope === entry.scope && pack.id === entry.id,
      );
      if (!installed || installed.version < entry.version) await args.install(entry);
    }
  }

  for (const pack of await listPacks(args.db)) {
    if (!indexed.has(`${pack.scope}:${pack.id}`)) await deletePack(args.db, pack.scope, pack.id);
  }

  const kept = (await listPacks(args.db)).map((pack) => JSON.parse(pack.manifest_json) as ManifestShape);
  const local = await listAssets(args.db);
  const drop = assetsToDelete(
    local.map((asset) => asset.sha),
    manifestShas(kept.map((manifest) => ({ assets: manifest.assets ?? [] }))),
  );
  for (const sha of drop) {
    const row = await getAsset(args.db, sha);
    if (row) await args.files.delete(row.local_uri);
    await deleteAsset(args.db, sha);
  }
}
