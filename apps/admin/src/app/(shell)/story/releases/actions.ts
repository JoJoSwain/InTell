"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canPreviewRelease,
  canPublishRelease,
  isActiveStaff,
  loadStaff,
  type StaffRole,
} from "@/lib/staff";
import { callEdgeFunction } from "@/lib/edge";
import {
  RELEASE_ITEM_ENTITIES,
  type ReleaseItemEntity,
} from "@/lib/releases/links";
import {
  failuresFromLastCheck,
  type ChecklistFailure,
} from "@/components/checklist-badges";
import { saveHref } from "@/lib/server-action-result";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");
  return { supabase, staff, userId: user.id };
}

async function requireEditor() {
  const ctx = await requireStaff();
  if (!canPublishRelease(ctx.staff.role)) {
    throw new Error("editor required");
  }
  return ctx;
}

function revalidateRelease(id: string) {
  revalidatePath("/story/releases");
  revalidatePath(`/story/releases/${id}`);
}

export async function createRelease(formData: FormData) {
  const { supabase, userId } = await requireEditor();
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!name) throw new Error("name required");

  const { data, error } = await supabase
    .from("releases")
    .insert({
      name,
      notes,
      status: "draft",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/story/releases");
  redirect(`/story/releases/${data.id}`);
}

export async function updateReleaseMeta(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!id || !name) throw new Error("id and name required");

  const { data: existing } = await supabase
    .from("releases")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) throw new Error("release not found");
  if (
    existing.status === "published" ||
    existing.status === "publishing" ||
    existing.status === "cancelled"
  ) {
    throw new Error("cannot edit this release");
  }

  const { error } = await supabase
    .from("releases")
    .update({ name, notes })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRelease(id);
  return { ok: true as const, href: saveHref(`/story/releases/${id}`) };
}

export async function addReleaseItem(formData: FormData) {
  const { supabase } = await requireEditor();
  const releaseId = String(formData.get("release_id") ?? "");
  const entity = String(formData.get("entity") ?? "") as ReleaseItemEntity;
  const entityId = String(formData.get("entity_id") ?? "").trim();
  if (!releaseId || !entityId) throw new Error("release and entity id required");
  if (!(RELEASE_ITEM_ENTITIES as readonly string[]).includes(entity)) {
    throw new Error("unsupported entity type");
  }

  await resetTowardDraft(supabase, releaseId);

  const { error } = await supabase.from("release_items").insert({
    release_id: releaseId,
    entity,
    entity_id: entityId,
  });
  if (error) throw new Error(error.message);
  revalidateRelease(releaseId);
  redirect(`/story/releases/${releaseId}`);
}

export async function removeReleaseItem(formData: FormData) {
  const { supabase } = await requireEditor();
  const releaseId = String(formData.get("release_id") ?? "");
  const entity = String(formData.get("entity") ?? "");
  const entityId = String(formData.get("entity_id") ?? "");
  if (!releaseId || !entity || !entityId) throw new Error("item required");

  await resetTowardDraft(supabase, releaseId);

  const { error } = await supabase
    .from("release_items")
    .delete()
    .eq("release_id", releaseId)
    .eq("entity", entity)
    .eq("entity_id", entityId);
  if (error) throw new Error(error.message);
  revalidateRelease(releaseId);
  redirect(`/story/releases/${releaseId}`);
}

/**
 * Convenience: insert release_items for DEPENDENCY_UNPUBLISHED failures
 * that map to allowed entity types (DATA_MODEL §10).
 */
export async function addMissingItems(formData: FormData) {
  const { supabase } = await requireEditor();
  const releaseId = String(formData.get("release_id") ?? "");
  if (!releaseId) throw new Error("release required");

  const { data: release } = await supabase
    .from("releases")
    .select("id, last_check, status")
    .eq("id", releaseId)
    .maybeSingle();
  if (!release) throw new Error("release not found");

  const failures = failuresFromLastCheck(release.last_check);
  const missing = failures.filter(
    (f) =>
      f.code === "DEPENDENCY_UNPUBLISHED" &&
      f.entity &&
      f.entity_id &&
      (RELEASE_ITEM_ENTITIES as readonly string[]).includes(f.entity),
  );

  const { data: existing } = await supabase
    .from("release_items")
    .select("entity, entity_id")
    .eq("release_id", releaseId);
  const have = new Set(
    (existing ?? []).map((i) => `${i.entity}:${i.entity_id}`),
  );

  const toInsert: { release_id: string; entity: string; entity_id: string }[] =
    [];
  const seen = new Set<string>();
  for (const f of missing) {
    const key = `${f.entity}:${f.entity_id}`;
    if (have.has(key) || seen.has(key)) continue;
    seen.add(key);
    toInsert.push({
      release_id: releaseId,
      entity: f.entity as string,
      entity_id: f.entity_id as string,
    });
  }

  if (toInsert.length) {
    await resetTowardDraft(supabase, releaseId);
    const { error } = await supabase.from("release_items").insert(toInsert);
    if (error) throw new Error(error.message);
  }

  revalidateRelease(releaseId);
  redirect(`/story/releases/${releaseId}`);
}

/** Editing items or rescheduling returns failed → draft. */
async function resetTowardDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  releaseId: string,
) {
  const { data } = await supabase
    .from("releases")
    .select("status")
    .eq("id", releaseId)
    .maybeSingle();
  if (!data) return;
  if (data.status === "failed" || data.status === "scheduled") {
    const { error } = await supabase
      .from("releases")
      .update({ status: "draft", publish_at: null })
      .eq("id", releaseId);
    if (error) throw new Error(error.message);
  }
}

export async function runPublishCheck(
  releaseId: string,
): Promise<
  | { ok: true; failures: ChecklistFailure[]; checkOk: boolean }
  | { ok: false; error: string }
> {
  const { supabase } = await requireEditor();
  const { data, error } = await supabase.rpc("fn_publish_check", {
    p_release_id: releaseId,
  });
  if (error) return { ok: false, error: error.message };
  const payload = data as {
    ok?: boolean;
    failures?: ChecklistFailure[];
  } | null;
  revalidateRelease(releaseId);
  return {
    ok: true,
    checkOk: Boolean(payload?.ok),
    failures: Array.isArray(payload?.failures) ? payload!.failures! : [],
  };
}

export async function publishNow(
  releaseId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireEditor();
  const result = await callEdgeFunction(supabase, "publish", {
    releaseId,
  });
  revalidateRelease(releaseId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/**
 * Schedule a release. Prefer `publish_at` (ISO UTC from the client).
 * Falls back to `publish_at_local` (datetime-local wall clock → Date → UTC).
 * Stored value is always UTC in `publish_at`.
 */
export async function scheduleRelease(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = String(formData.get("release_id") ?? "");
  const isoRaw = String(formData.get("publish_at") ?? "").trim();
  const localRaw = String(formData.get("publish_at_local") ?? "").trim();
  if (!id || (!isoRaw && !localRaw)) {
    throw new Error("release and publish time required");
  }

  const publishAt = isoRaw ? new Date(isoRaw) : new Date(localRaw);
  if (Number.isNaN(publishAt.getTime())) {
    throw new Error("invalid publish time");
  }

  const { data: existing } = await supabase
    .from("releases")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) throw new Error("release not found");
  if (
    existing.status !== "draft" &&
    existing.status !== "failed" &&
    existing.status !== "scheduled"
  ) {
    throw new Error("cannot schedule this release");
  }

  const { error } = await supabase
    .from("releases")
    .update({
      status: "scheduled",
      publish_at: publishAt.toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRelease(id);
  redirect(`/story/releases/${id}`);
}

export async function cancelSchedule(releaseId: string) {
  const { supabase } = await requireEditor();
  if (!releaseId) throw new Error("release required");

  const { error } = await supabase
    .from("releases")
    .update({ status: "cancelled", publish_at: null })
    .eq("id", releaseId)
    .eq("status", "scheduled");
  if (error) throw new Error(error.message);
  revalidateRelease(releaseId);
  redirect(`/story/releases/${releaseId}`);
}

/** Form-friendly wrapper for cancelSchedule. */
export async function cancelScheduleForm(formData: FormData) {
  const id = String(formData.get("release_id") ?? "");
  await cancelSchedule(id);
}

export async function retryFailed(releaseId: string) {
  const { supabase } = await requireEditor();
  if (!releaseId) throw new Error("release required");

  const { error } = await supabase
    .from("releases")
    .update({ status: "draft", publish_at: null })
    .eq("id", releaseId)
    .eq("status", "failed");
  if (error) throw new Error(error.message);
  revalidateRelease(releaseId);
  redirect(`/story/releases/${releaseId}`);
}

/** Form-friendly wrapper; mode=publish retries via publish edge. */
export async function retryFailedForm(formData: FormData) {
  const id = String(formData.get("release_id") ?? "");
  const mode = String(formData.get("mode") ?? "draft");
  if (mode === "publish") {
    const result = await publishNow(id);
    if (!result.ok) throw new Error(result.error);
    revalidateRelease(id);
    redirect(`/story/releases/${id}`);
  }
  await retryFailed(id);
}

export async function copyToNewDraft(releaseId: string) {
  const { supabase, userId } = await requireEditor();
  if (!releaseId) throw new Error("release required");

  const { data: src } = await supabase
    .from("releases")
    .select("id, name, notes, status")
    .eq("id", releaseId)
    .maybeSingle();
  if (!src || src.status !== "cancelled") {
    throw new Error("cancelled release required");
  }

  const { data: items } = await supabase
    .from("release_items")
    .select("entity, entity_id")
    .eq("release_id", releaseId);

  const { data: created, error } = await supabase
    .from("releases")
    .insert({
      name: `${src.name} (copy)`,
      notes: src.notes,
      status: "draft",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (items?.length) {
    const { error: itemErr } = await supabase.from("release_items").insert(
      items.map((i) => ({
        release_id: created.id as string,
        entity: i.entity as string,
        entity_id: i.entity_id as string,
      })),
    );
    if (itemErr) throw new Error(itemErr.message);
  }

  revalidatePath("/story/releases");
  redirect(`/story/releases/${created.id}`);
}

export async function copyToNewDraftForm(formData: FormData) {
  const id = String(formData.get("release_id") ?? "");
  await copyToNewDraft(id);
}

export type PreviewSummary = {
  groves: number;
  fragments: number;
  assetCount: number;
  expiresAt: string | null;
};

export async function checkPreview(
  releaseId: string,
): Promise<
  | { ok: true; summary: PreviewSummary }
  | { ok: false; error: string }
> {
  const { supabase, staff } = await requireStaff();
  if (!canPreviewRelease(staff.role as StaffRole)) {
    return { ok: false, error: "preview not allowed for this role" };
  }

  const result = await callEdgeFunction(supabase, "preview", {
    releaseId,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const data = result.data as {
    groves?: unknown[];
    assets?: unknown[];
    expiresAt?: string;
    generatedAt?: string;
  };

  const groves = Array.isArray(data.groves) ? data.groves : [];
  let fragments = 0;
  for (const g of groves) {
    const frags = (g as { fragments?: unknown[] }).fragments;
    if (Array.isArray(frags)) fragments += frags.length;
  }
  const assets = Array.isArray(data.assets) ? data.assets : [];

  return {
    ok: true,
    summary: {
      groves: groves.length,
      fragments,
      assetCount: assets.length,
      expiresAt: data.expiresAt ?? null,
    },
  };
}
