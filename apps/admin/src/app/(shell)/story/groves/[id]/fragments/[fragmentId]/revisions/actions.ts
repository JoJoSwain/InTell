"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canWriteRevisions,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { saveHref } from "@/lib/server-action-result";

type TimeWindow = "day" | "night";
type ChangeKind = "contingency" | "correction";

async function requireRevisionWriter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canWriteRevisions(staff.role)) {
    throw new Error("writer required");
  }
  return { supabase, staff, userId: user.id };
}

function revisionsBase(groveId: string, fragmentId: string) {
  return `/story/groves/${groveId}/fragments/${fragmentId}/revisions`;
}

function parseVersion(
  formData: FormData,
  window: TimeWindow,
): {
  include: boolean;
  narration_asset_id: string;
  transcript: string;
  vtt: string | null;
  other_time_hint: string;
  version_id: string | null;
} {
  const include = formData.get(`include_${window}`) === "on";
  return {
    include,
    narration_asset_id: String(
      formData.get(`${window}_narration_asset_id`) ?? "",
    ).trim(),
    transcript: String(formData.get(`${window}_transcript`) ?? ""),
    vtt: String(formData.get(`${window}_vtt`) ?? "").trim() || null,
    other_time_hint: String(
      formData.get(`${window}_other_time_hint`) ?? "",
    ).trim(),
    version_id: String(formData.get(`${window}_version_id`) ?? "").trim() || null,
  };
}

function asL10nOrEmpty(text: string): Record<string, string> {
  return text ? { en: text } : {};
}

async function syncVersions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  revisionId: string,
  day: ReturnType<typeof parseVersion>,
  night: ReturnType<typeof parseVersion>,
) {
  const windows: { window: TimeWindow; data: ReturnType<typeof parseVersion> }[] =
    [
      { window: "day", data: day },
      { window: "night", data: night },
    ];

  for (const { window, data } of windows) {
    if (!data.include) {
      if (data.version_id) {
        const { error } = await supabase
          .from("revision_versions")
          .delete()
          .eq("id", data.version_id);
        if (error) throw new Error(error.message);
      }
      continue;
    }
    if (!data.narration_asset_id) {
      throw new Error(`${window}: narration asset required`);
    }
    // Transcript may be empty in draft; checklist blocks publish (NO_TRANSCRIPT).
    if (data.version_id) {
      const { error } = await supabase
        .from("revision_versions")
        .update({
          narration_asset_id: data.narration_asset_id,
          transcript: data.transcript,
          vtt: data.vtt,
          other_time_hint: asL10nOrEmpty(data.other_time_hint),
          language: "en",
          time_window: window,
        })
        .eq("id", data.version_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("revision_versions").insert({
        revision_id: revisionId,
        language: "en",
        time_window: window,
        narration_asset_id: data.narration_asset_id,
        transcript: data.transcript,
        vtt: data.vtt,
        other_time_hint: asL10nOrEmpty(data.other_time_hint),
      });
      if (error) throw new Error(error.message);
    }
  }
}

export async function createRevision(formData: FormData) {
  const { supabase, userId } = await requireRevisionWriter();
  const groveId = String(formData.get("grove_id") ?? "");
  const fragmentId = String(formData.get("fragment_id") ?? "");
  const isFirst = formData.get("is_first") === "1";
  const changeKindRaw = String(formData.get("change_kind") ?? "").trim();
  const changeNote =
    String(formData.get("change_note") ?? "").trim() || null;
  const changeTeaserEn = String(formData.get("change_teaser_en") ?? "").trim();

  if (!groveId || !fragmentId) throw new Error("grove and fragment required");

  let changeKind: ChangeKind;
  if (isFirst) {
    changeKind = "contingency";
  } else {
    if (changeKindRaw !== "contingency" && changeKindRaw !== "correction") {
      throw new Error("change_kind required");
    }
    changeKind = changeKindRaw;
  }

  const day = parseVersion(formData, "day");
  const night = parseVersion(formData, "night");
  if (!day.include && !night.include) {
    throw new Error("at least one of Day or Night is required");
  }

  // Do NOT send revision_no — DB trigger assigns it (M3d D2).
  const { data, error } = await supabase
    .from("fragment_revisions")
    .insert({
      fragment_id: fragmentId,
      change_kind: changeKind,
      change_note: changeNote,
      change_teaser: asL10nOrEmpty(changeTeaserEn),
      status: "draft",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const revisionId = data.id as string;

  await syncVersions(supabase, revisionId, day, night);

  const base = revisionsBase(groveId, fragmentId);
  revalidatePath(base);
  revalidatePath(`/story/groves/${groveId}`);
  return { ok: true as const, href: saveHref(`${base}/${revisionId}`) };
}

export async function updateRevision(formData: FormData) {
  const { supabase } = await requireRevisionWriter();
  const groveId = String(formData.get("grove_id") ?? "");
  const fragmentId = String(formData.get("fragment_id") ?? "");
  const revisionId = String(formData.get("revision_id") ?? "");
  const isFirst = formData.get("is_first") === "1";
  const changeKindRaw = String(formData.get("change_kind") ?? "").trim();
  const changeNote =
    String(formData.get("change_note") ?? "").trim() || null;
  const changeTeaserEn = String(formData.get("change_teaser_en") ?? "").trim();

  if (!groveId || !fragmentId || !revisionId) {
    throw new Error("grove, fragment and revision required");
  }

  const { data: existing, error: loadErr } = await supabase
    .from("fragment_revisions")
    .select("id, status, revision_no")
    .eq("id", revisionId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error("revision not found");
  if (existing.status !== "draft") {
    throw new Error("only draft revisions can be edited");
  }

  let changeKind: ChangeKind;
  if (isFirst || existing.revision_no === 1) {
    changeKind = "contingency";
  } else {
    if (changeKindRaw !== "contingency" && changeKindRaw !== "correction") {
      throw new Error("change_kind required");
    }
    changeKind = changeKindRaw;
  }

  const day = parseVersion(formData, "day");
  const night = parseVersion(formData, "night");
  if (!day.include && !night.include) {
    throw new Error("at least one of Day or Night is required");
  }

  const { error } = await supabase
    .from("fragment_revisions")
    .update({
      change_kind: changeKind,
      change_note: changeNote,
      change_teaser: asL10nOrEmpty(changeTeaserEn),
    })
    .eq("id", revisionId);
  if (error) throw new Error(error.message);

  await syncVersions(supabase, revisionId, day, night);

  const base = revisionsBase(groveId, fragmentId);
  revalidatePath(base);
  revalidatePath(`${base}/${revisionId}`);
  revalidatePath(`/story/groves/${groveId}`);
  return { ok: true as const, href: saveHref(`${base}/${revisionId}`) };
}

export async function deleteDraftRevision(formData: FormData) {
  const { supabase, staff } = await requireRevisionWriter();
  // Editors delete; writers may only delete drafts they can update (RLS).
  void staff;
  const groveId = String(formData.get("grove_id") ?? "");
  const fragmentId = String(formData.get("fragment_id") ?? "");
  const revisionId = String(formData.get("revision_id") ?? "");
  if (!revisionId) throw new Error("revision required");

  const { error } = await supabase
    .from("fragment_revisions")
    .delete()
    .eq("id", revisionId)
    .eq("status", "draft");
  if (error) throw new Error(error.message);

  const base = revisionsBase(groveId, fragmentId);
  revalidatePath(base);
  revalidatePath(`/story/groves/${groveId}`);
  redirect(base);
}
