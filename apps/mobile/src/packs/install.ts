import { GrovePack, PackIndexEntry, RegionPack } from "@intell/shared";
import { assetObjectPath, publicMediaUrl } from "../api/mediaUrl";
import type { SqlDriver } from "../db/driver";
import { getAsset, listPacks, upsertAsset, upsertPack } from "../db/repos";
import { joinPath, type FileStore } from "../files/store";

export type Digester = (bytes: Uint8Array) => Promise<string>;
export type HttpResponse = { status: number; body: Uint8Array };
export type HttpGet = (url: string) => Promise<HttpResponse>;

export class MissingObjectError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`storage object missing (${status})`);
    this.name = "MissingObjectError";
    this.status = status;
  }
}

export class ShaMismatchError extends Error {
  constructor(kind: string) {
    super(`${kind} sha256 did not match`);
    this.name = "ShaMismatchError";
  }
}

export function throwIfMissing(status: number): void {
  if (status === 400 || status === 404) throw new MissingObjectError(status);
}

export async function installPack(args: {
  entry: PackIndexEntry;
  supabaseUrl: string;
  http: HttpGet;
  files: FileStore;
  db: SqlDriver;
  digest: Digester;
  assetDirectory: string;
  stagingDirectory: string;
  now?: () => string;
}): Promise<"installed" | "unchanged"> {
  const now = args.now ?? (() => new Date().toISOString());
  if (await installedAndComplete(args)) return "unchanged";

  const manifestUrl = publicMediaUrl(args.supabaseUrl, args.entry.manifestPath);
  const manifestResponse = await args.http(manifestUrl);
  throwIfMissing(manifestResponse.status);
  if (manifestResponse.status !== 200) {
    throw new Error(`manifest download failed (${manifestResponse.status})`);
  }
  const manifestHash = (await args.digest(manifestResponse.body)).toLowerCase();
  if (manifestHash !== args.entry.manifestSha256.toLowerCase()) {
    throw new ShaMismatchError("manifest");
  }

  const parsed: unknown = JSON.parse(new TextDecoder().decode(manifestResponse.body));
  const pack = args.entry.scope === "grove" ? GrovePack.parse(parsed) : RegionPack.parse(parsed);
  const stageDir = joinPath(
    args.stagingDirectory,
    `${args.entry.scope}/${args.entry.id}/${args.entry.version}`,
  );

  for (const asset of pack.assets) {
    const staged = joinPath(stageDir, `${asset.sha}.${asset.ext}`);
    const existing = await args.files.read(staged);
    if (existing && (await args.digest(existing)).toLowerCase() === asset.sha) continue;
    if (existing) await args.files.delete(staged);
    const objectPath = assetObjectPath(asset.kind, asset.sha, asset.ext);
    const response = await args.http(publicMediaUrl(args.supabaseUrl, objectPath));
    throwIfMissing(response.status);
    if (response.status !== 200) throw new Error(`asset download failed (${response.status})`);
    const hash = (await args.digest(response.body)).toLowerCase();
    if (hash !== asset.sha) throw new ShaMismatchError("asset");
    await args.files.write(staged, response.body);
  }

  const localUris: { sha: string; ext: string; bytes: number; localUri: string }[] = [];
  for (const asset of pack.assets) {
    const staged = joinPath(stageDir, `${asset.sha}.${asset.ext}`);
    const dest = joinPath(args.assetDirectory, `${asset.sha}.${asset.ext}`);
    const stagedBytes = await args.files.read(staged);
    if (stagedBytes) await args.files.move(staged, dest);
    else if (!(await args.files.exists(dest))) throw new Error("staged file missing");
    const finalBytes = await args.files.read(dest);
    localUris.push({
      sha: asset.sha,
      ext: asset.ext,
      bytes: finalBytes?.byteLength ?? asset.bytes,
      localUri: dest,
    });
  }

  const manifestJson = JSON.stringify(pack);
  await args.db.withTransaction(async () => {
    for (const asset of localUris) {
      await upsertAsset(args.db, {
        sha: asset.sha,
        ext: asset.ext,
        bytes: asset.bytes,
        local_uri: asset.localUri,
        last_used_at: now(),
      });
    }
    await upsertPack(args.db, {
      scope: args.entry.scope,
      id: args.entry.id,
      version: args.entry.version,
      manifest_json: manifestJson,
      installed_at: now(),
    });
  });
  return "installed";
}

async function installedAndComplete(args: {
  entry: PackIndexEntry;
  files: FileStore;
  db: SqlDriver;
}): Promise<boolean> {
  const packs = await listPacks(args.db);
  const current = packs.find((pack) => pack.scope === args.entry.scope && pack.id === args.entry.id);
  if (!current || current.version !== args.entry.version) return false;
  const manifest = JSON.parse(current.manifest_json) as { assets?: { sha: string }[] };
  for (const asset of manifest.assets ?? []) {
    const row = await getAsset(args.db, asset.sha);
    if (!row || !(await args.files.exists(row.local_uri))) return false;
  }
  return true;
}
