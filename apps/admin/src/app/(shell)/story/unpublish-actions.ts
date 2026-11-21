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
  return { ok: true, warnings: asWarnings(payload?.warnings) };
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
