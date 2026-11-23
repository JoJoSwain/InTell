import { PreviewManifest } from "@intell/shared";
import type { SqlDriver } from "../db/driver";
import { deleteAllPreview, listAssets, listPreview, upsertPreview } from "../db/repos";
import { joinPath, type FileStore } from "../files/store";
import { ShaMismatchError, throwIfMissing, type Digester, type HttpGet } from "../packs/install";

export class PreviewForbiddenError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`preview refused (${status})`);
    this.name = "PreviewForbiddenError";
    this.status = status;
  }
}

export type PreviewResponse = { status: number; body: unknown };

export async function storePreview(args: {
  response: PreviewResponse;
  db: SqlDriver;
  files: FileStore;
  http: HttpGet;
  digest: Digester;
  previewDirectory: string;
  now?: () => string;
}): Promise<void> {
  if (args.response.status === 401 || args.response.status === 403) {
    throw new PreviewForbiddenError(args.response.status);
  }
  if (args.response.status !== 200) throw new Error(`preview failed (${args.response.status})`);
  const manifest = PreviewManifest.parse(args.response.body);
  const now = args.now ?? (() => new Date().toISOString());
  const written: string[] = [];
  try {
    for (const asset of manifest.assets) {
      const response = await args.http(asset.url);
      throwIfMissing(response.status);
      if (response.status !== 200) throw new Error(`preview asset failed (${response.status})`);
      const hash = (await args.digest(response.body)).toLowerCase();
      if (hash !== asset.sha) throw new ShaMismatchError("preview asset");
      const dest = joinPath(args.previewDirectory, `${asset.sha}.${asset.ext}`);
      await args.files.write(dest, response.body);
      written.push(dest);
    }
    await upsertPreview(args.db, {
      release_id: manifest.releaseId,
      manifest_json: JSON.stringify(manifest),
      fetched_at: now(),
    });
  } catch (error) {
    for (const uri of written) await args.files.delete(uri);
    throw error;
  }
}

export async function clearPreview(args: {
  db: SqlDriver;
  files: FileStore;
  previewDirectory: string;
  signOut: () => Promise<void>;
  reexcludePreview: () => void;
}): Promise<void> {
  await args.signOut();
  await deleteAllPreview(args.db);
  for (const uri of await args.files.list(args.previewDirectory)) await args.files.delete(uri);
  args.reexcludePreview();
}

export async function previewIsEmpty(db: SqlDriver): Promise<boolean> {
  return (await listPreview(db)).length === 0;
}

export async function installedAssetShas(db: SqlDriver): Promise<string[]> {
  return (await listAssets(db)).map((asset) => asset.sha);
}
