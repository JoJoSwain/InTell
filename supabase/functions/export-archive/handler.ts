import { ExportArchiveRequest } from "../_shared/from-shared/device.ts";
import { json } from "../_shared/http.ts";

export type ExportFile = { path: string; content: string | Uint8Array };

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
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
