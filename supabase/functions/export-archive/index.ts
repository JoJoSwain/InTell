import JSZip from "jszip";
import { requireStaffEditor } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/clients.ts";
import { json } from "../_shared/http.ts";
import {
  exportAuditInsert,
  handleExportArchive,
  type ExportFile,
} from "./handler.ts";

type Svc = ReturnType<typeof serviceClient>;

async function groveIdsForRegion(
  svc: Svc,
  regionId: string | undefined,
): Promise<string[] | null> {
  if (!regionId) return null;
  const { data, error } = await svc
    .from("groves")
    .select("id")
    .eq("region_id", regionId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((g) => g.id as string);
}

async function buildArchiveFiles(
  svc: Svc,
  regionId: string | undefined,
): Promise<ExportFile[]> {
  const groveFilter = await groveIdsForRegion(svc, regionId);

  let grovesQ = svc
    .from("groves")
    .select("id, region_id, slug, name, status, created_at, updated_at");
  if (groveFilter) grovesQ = grovesQ.in("id", groveFilter);
  const { data: groves, error: gErr } = await grovesQ;
  if (gErr) throw new Error(gErr.message);

  let regionsQ = svc
    .from("regions")
    .select("id, slug, name, timezone, pack_version, created_at, updated_at");
  if (regionId) {
    regionsQ = regionsQ.eq("id", regionId);
  } else {
    const regionIds = [
      ...new Set(
        (groves ?? [])
          .map((g) => g.region_id as string | null)
          .filter((id): id is string => id != null),
      ),
    ];
    if (regionIds.length) regionsQ = regionsQ.in("id", regionIds);
  }
  const { data: regions, error: rErr } = await regionsQ;
  if (rErr) throw new Error(rErr.message);

  let fragsQ = svc
    .from("fragments")
    .select(
      "id, grove_id, tier, is_ending, title, teaser, status, story_order, visibility, indigeny_earth, indigeny_world, indigeny_body",
    );
  if (groveFilter) fragsQ = fragsQ.in("grove_id", groveFilter);
  const { data: fragments, error: fErr } = await fragsQ;
  if (fErr) throw new Error(fErr.message);
  const fragmentIds = (fragments ?? []).map((f) => f.id as string);

  let revsQ = svc.from("fragment_revisions").select(
    "id, fragment_id, status, change_kind, change_note, release_id, created_at, updated_at",
  );
  if (groveFilter) {
    revsQ = fragmentIds.length
      ? revsQ.in("fragment_id", fragmentIds)
      : revsQ.in("fragment_id", ["00000000-0000-4000-8000-000000000000"]);
  }
  const { data: revisions, error: revErr } = await revsQ;
  if (revErr) throw new Error(revErr.message);
  const revisionIds = (revisions ?? []).map((r) => r.id as string);

  let versQ = svc.from("revision_versions").select(
    "id, revision_id, language, time_window, transcript, narration_asset_id",
  );
  if (groveFilter) {
    versQ = revisionIds.length
      ? versQ.in("revision_id", revisionIds)
      : versQ.in("revision_id", ["00000000-0000-4000-8000-000000000000"]);
  }
  const { data: versions, error: vErr } = await versQ;
  if (vErr) throw new Error(vErr.message);

  const { data: threads, error: tErr } = await svc
    .from("threads")
    .select("id, title, notes, created_at, updated_at");
  if (tErr) throw new Error(tErr.message);

  const { data: characters, error: cErr } = await svc
    .from("characters")
    .select(
      "id, name, public_name, public_intro, notes, home_grove_id, status, portrait_image_id, created_at, updated_at",
    );
  if (cErr) throw new Error(cErr.message);

  const { data: releases, error: relErr } = await svc
    .from("releases")
    .select("id, name, status, published_at, created_at, updated_at");
  if (relErr) throw new Error(relErr.message);

  const { data: audioAssets, error: aErr } = await svc
    .from("audio_assets")
    .select(
      "id, sha256, kind, staging_path, duration_ms, bytes, title, is_public, ext",
    );
  if (aErr) throw new Error(aErr.message);

  const { data: imageAssets, error: iErr } = await svc
    .from("image_assets")
    .select(
      "id, sha256, staging_path, bytes, alt_text, title, is_public, ext",
    );
  if (iErr) throw new Error(iErr.message);

  const files: ExportFile[] = [];

  files.push({
    path: "metadata/regions.json",
    content: JSON.stringify(regions ?? [], null, 2),
  });
  files.push({
    path: "metadata/groves.json",
    content: JSON.stringify(groves ?? [], null, 2),
  });
  files.push({
    path: "metadata/fragments.json",
    content: JSON.stringify(fragments ?? [], null, 2),
  });
  files.push({
    path: "metadata/characters.json",
    content: JSON.stringify(characters ?? [], null, 2),
  });
  files.push({
    path: "metadata/releases.json",
    content: JSON.stringify(releases ?? [], null, 2),
  });
  files.push({
    path: "revisions/revisions.json",
    content: JSON.stringify(revisions ?? [], null, 2),
  });

  for (const ver of versions ?? []) {
    const revId = ver.revision_id as string;
    const lang = ver.language as string;
    const tw = ver.time_window as string;
    const transcript = (ver.transcript as string) ?? "";
    files.push({
      path: `transcripts/${revId}_${lang}_${tw}.md`,
      content: `# Transcript\n\n- revision: ${revId}\n- language: ${lang}\n- time_window: ${tw}\n\n${transcript}\n`,
    });
  }

  const threadMd = (threads ?? [])
    .map((t) => `## ${t.title}\n\n${t.notes ?? ""}\n`)
    .join("\n");
  files.push({
    path: "story-notes/threads.md",
    content: `# Threads\n\n${threadMd}`,
  });

  const charNotesMd = (characters ?? [])
    .map((c) => `## ${c.name}\n\n${c.notes ?? ""}\n`)
    .join("\n");
  files.push({
    path: "story-notes/character-notes.md",
    content: `# Character notes\n\n${charNotesMd}`,
  });

  const indigenyMd = (fragments ?? [])
    .map((f) => {
      const earth = f.indigeny_earth ?? "";
      const world = f.indigeny_world ?? "";
      const body = f.indigeny_body ?? "";
      if (!earth && !world && !body) return null;
      return `## Fragment ${f.id}\n\n### Earth\n${earth}\n\n### World\n${world}\n\n### Body\n${body}\n`;
    })
    .filter((s): s is string => s != null)
    .join("\n");
  files.push({
    path: "story-notes/indigeny.md",
    content: `# Indigeny notes\n\n${indigenyMd}`,
  });

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    regionId: regionId ?? null,
    note: "Audio bytes are not included in v1; use staging_path / public pack paths to fetch separately.",
    assets: [
      ...(audioAssets ?? []).map((a) => ({
        sha256: a.sha256,
        kind: a.kind,
        storagePath: a.staging_path,
        media: "audio" as const,
        isPublic: a.is_public,
        ext: a.ext,
      })),
      ...(imageAssets ?? []).map((a) => ({
        sha256: a.sha256,
        kind: "image",
        storagePath: a.staging_path,
        media: "image" as const,
        isPublic: a.is_public,
        ext: a.ext,
      })),
    ],
  };
  files.push({
    path: "manifest.json",
    content: JSON.stringify(manifest, null, 2),
  });

  return files;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const gate = await requireStaffEditor(req);
  if (!gate.ok) return gate.response;

  let payload: unknown = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      return json({ error: "invalid body" }, 400);
    }
  }

  const svc = serviceClient();

  return handleExportArchive(payload, {
    log: (event) => console.log(`export-archive ${event}`),
    buildFiles: async (regionId) => {
      try {
        if (regionId) {
          const { data, error } = await svc
            .from("regions")
            .select("id")
            .eq("id", regionId)
            .maybeSingle();
          if (error) return { error: "region lookup failed", status: 500 };
          if (!data) return { error: "region not found", status: 404 };
        }
        const files = await buildArchiveFiles(svc, regionId);
        return { files, scope: { regionId: regionId ?? null } };
      } catch (e) {
        return {
          error: e instanceof Error ? e.message : "build failed",
          status: 500,
        };
      }
    },
    zip: async (files) => {
      const zip = new JSZip();
      for (const f of files) {
        zip.file(f.path, f.content);
      }
      return zip.generateAsync({ type: "uint8array" });
    },
    audit: async (scope) => {
      const { error } = await svc
        .from("audit_log")
        .insert(exportAuditInsert(gate.userId, scope));
      if (error) return { error: error.message };
    },
  });
});
