import { ExportArchiveRequest } from "../_shared/from-shared/device.ts";
import { json } from "../_shared/http.ts";

export type ExportFile = { path: string; content: string | Uint8Array };

/** One hour — staff run `tools/archive-audio` before these expire. */
export const ARCHIVE_TTL_SEC = 3600;

/** audit_log row for one archive export. Scope is a region id, or "all". */
export function exportAuditInsert(
  actor: string,
  scope: { regionId: string | null },
) {
  return {
    actor,
    action: "export_archive" as const,
    entity: scope.regionId ? "region" : "story",
    entity_id: scope.regionId,
    detail: { scope: scope.regionId ?? "all" },
  };
}

export type ManifestAssetInput = {
  sha256: string;
  kind: string;
  storagePath: string;
  media: "audio" | "image";
  isPublic: boolean;
  ext: string;
};

export type SignedManifestAsset = ManifestAssetInput & {
  url: string;
  expiresAt: string;
};

/** `staging-audio/sha.ext` → bucket + object path for createSignedUrl. */
export function parseStagingPath(
  stagingPath: string,
): { bucket: string; objectPath: string } | null {
  const normalized = stagingPath.replace(/^\/+/, "");
  const slash = normalized.indexOf("/");
  if (slash <= 0 || slash === normalized.length - 1) return null;
  return {
    bucket: normalized.slice(0, slash),
    objectPath: normalized.slice(slash + 1),
  };
}

export function archiveExpiresAt(nowMs: number, ttlSec = ARCHIVE_TTL_SEC): string {
  return new Date(nowMs + ttlSec * 1000).toISOString();
}

/**
 * Attach a signed URL and expiresAt to every asset. Missing objects get an
 * empty url so the archive still builds; the staff tool reports the miss.
 */
export async function signManifestAssets(
  assets: ManifestAssetInput[],
  expiresAt: string,
  sign: (bucket: string, objectPath: string) => Promise<string | null>,
): Promise<SignedManifestAsset[]> {
  const out: SignedManifestAsset[] = [];
  for (const asset of assets) {
    const parsed = parseStagingPath(asset.storagePath);
    let url = "";
    if (parsed) {
      url = (await sign(parsed.bucket, parsed.objectPath)) ?? "";
    }
    out.push({ ...asset, url, expiresAt });
  }
  return out;
}

export type ExportDeps = {
  buildFiles: (regionId: string | undefined) => Promise<
    | { files: ExportFile[]; scope: { regionId: string | null } }
    | { error: string; status?: number }
  >;
  zip: (files: ExportFile[]) => Promise<Uint8Array>;
  audit: (scope: { regionId: string | null }) => Promise<void | { error: string }>;
  log: (event: string) => void;
};

export async function handleExportArchive(
  body: unknown,
  deps: ExportDeps,
): Promise<Response> {
  const parsed = ExportArchiveRequest.safeParse(
    body === undefined || body === null || body === "" ? {} : body,
  );
  if (!parsed.success) {
    deps.log("invalid-body");
    return json({ error: "invalid body" }, 400);
  }

  const built = await deps.buildFiles(parsed.data.regionId);
  if ("error" in built) {
    deps.log("build-error");
    return json({ error: built.error }, built.status ?? 500);
  }

  const auditResult = await deps.audit(built.scope);
  if (auditResult && "error" in auditResult) {
    deps.log("audit-error");
    return json({ error: "audit failed" }, 500);
  }

  const bytes = await deps.zip(built.files);
  const name = built.scope.regionId
    ? `intell-archive-${built.scope.regionId}.zip`
    : "intell-archive.zip";
  deps.log("ok");
  // Deno DOM typings reject Uint8Array<ArrayBufferLike> as BodyInit.
  const zipBody = new Uint8Array(bytes) as unknown as BodyInit;
  return new Response(zipBody, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
