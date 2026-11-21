"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canPublishRelease,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { callEdgeFunction } from "@/lib/edge";
import type { ChecklistFailure } from "@/components/checklist-badges";

export type UnpublishEntity =
  | "grove"
  | "fragment"
  | "revision"
  | "character"
  | "image";

async function requirePublisher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canPublishRelease(staff.role)) {
    throw new Error("editor required");
  }
  return { supabase, staff };
}

function asWarnings(raw: unknown): ChecklistFailure[] {
  if (!Array.isArray(raw)) return [];
  return raw as ChecklistFailure[];
}

function l10nTitle(title: unknown): string | null {
  if (!title || typeof title !== "object") return null;
  const en = (title as Record<string, unknown>).en;
  return typeof en === "string" && en.trim() ? en.trim() : null;
}

/** Attach human fragment titles so stranded warnings name the dependent. */
async function withFragmentTitles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  warnings: ChecklistFailure[],
): Promise<ChecklistFailure[]> {
  const fragIds = [
    ...new Set(
      warnings
        .filter((w) => w.entity === "fragment" && w.entity_id)
        .map((w) => w.entity_id as string),
    ),
  ];
  if (!fragIds.length) return warnings;
  const { data } = await supabase
    .from("fragments")
    .select("id, title")
    .in("id", fragIds);
  const titles = new Map<string, string>();
  for (const row of data ?? []) {
    const name = l10nTitle(row.title);
    if (name) titles.set(row.id as string, name);
  }
  return warnings.map((w) => {
    if (w.entity !== "fragment" || !w.entity_id) return w;
    const name = titles.get(w.entity_id);
    if (!name) return w;
    return {
      ...w,
      message: `${w.message}: ${name}`,
    };
  });
}

export async function previewUnpublish(
  entity: UnpublishEntity,
  ids: string[],
): Promise<
  | { ok: true; warnings: ChecklistFailure[] }
  | { ok: false; error: string }
> {
  const { supabase } = await requirePublisher();
  const { data, error } = await supabase.rpc("fn_unpublish_preview", {
    p_entity: entity,
    p_ids: ids,
  });
  if (error) return { ok: false, error: error.message };
  const payload = data as { ok?: boolean; warnings?: unknown } | null;
  const warnings = await withFragmentTitles(
    supabase,
    asWarnings(payload?.warnings),
  );
  return { ok: true, warnings };
}

export async function confirmUnpublish(
  entity: UnpublishEntity,
  ids: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requirePublisher();
  const result = await callEdgeFunction(supabase, "unpublish", {
    entity,
    ids,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/story/groves");
  revalidatePath("/story/releases");
  revalidatePath("/story/characters");
  revalidatePath("/media/images");
  return { ok: true };
}
