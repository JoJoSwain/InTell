import type { SqlDriver } from "../db/driver";
import { deleteAllPreview, deleteAsset, deletePack, getAsset, listAssets, listPacks, listPreview } from "../db/repos";
import { joinPath, type FileStore } from "../files/store";

type ManifestShape = { assets?: { sha: string; ext: string }[] };

/** Drops packs whose files are gone and keeps progress tables untouched. */
export async function reconcile(args: {
  db: SqlDriver;
  files: FileStore;
  assetDirectory: string;
  previewDirectory: string;
}): Promise<void> {
  for (const asset of await listAssets(args.db)) {
    if (!(await args.files.exists(asset.local_uri))) await deleteAsset(args.db, asset.sha);
  }

  for (const pack of await listPacks(args.db)) {
    const manifest = JSON.parse(pack.manifest_json) as ManifestShape;
    for (const asset of manifest.assets ?? []) {
      const row = await getAsset(args.db, asset.sha);
      if (!row) {
        await deletePack(args.db, pack.scope, pack.id);
        break;
      }
    }
  }

  const known = new Set((await listAssets(args.db)).map((asset) => asset.sha));
  for (const uri of await args.files.list(args.assetDirectory)) {
    const name = uri.slice(uri.lastIndexOf("/") + 1);
    const sha = name.split(".")[0] ?? "";
    if (!known.has(sha)) await args.files.delete(uri);
  }

  for (const preview of await listPreview(args.db)) {
    const manifest = JSON.parse(preview.manifest_json) as ManifestShape;
    const missing = [];
    for (const asset of manifest.assets ?? []) {
      const uri = joinPath(args.previewDirectory, `${asset.sha}.${asset.ext}`);
      if (!(await args.files.exists(uri))) missing.push(uri);
    }
    if (missing.length > 0) {
      await deleteAllPreview(args.db);
      for (const uri of await args.files.list(args.previewDirectory)) await args.files.delete(uri);
      break;
    }
  }
}
