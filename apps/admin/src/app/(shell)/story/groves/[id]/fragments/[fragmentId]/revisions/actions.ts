"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canWriteRevisions,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import {
  type ActionAuthResult,
  saveHref,
  serverActionError,
} from "@/lib/server-action-result";
import { parseCommaSeparatedInts } from "@/lib/sound/helpers";
import { normalizeTimingMsList } from "@/lib/sound/validate";

type TimeWindow = "day" | "night";
type ChangeKind = "contingency" | "correction";

type RevisionWriterContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  staff: Awaited<ReturnType<typeof loadStaff>>;
  userId: string;
};

async function requireRevisionWriter(): Promise<
  ActionAuthResult<RevisionWriterContext>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canWriteRevisions(staff.role)) {
    return serverActionError("writer required");
  }
  return { ok: true, supabase, staff, userId: user.id };
}

async function requireRevisionWriterOrThrow(): Promise<RevisionWriterContext> {
  const auth = await requireRevisionWriter();
  if (!auth.ok) throw new Error(auth.error);
  return auth;
}

function revisionsBase(groveId: string, fragmentId: string) {
  return `/story/groves/${groveId}/fragments/${fragmentId}/revisions`;
}

function parseVersionFields(
  formData: FormData,
  window: TimeWindow,
): {
  include: boolean;
  narration_asset_id: string;
  transcript: string;
  vtt: string | null;
  other_time_hint: string;
  version_id: string | null;
  breath_points_ms: number[];
  swell_cues_ms: number[];
} {
  const include = formData.get(`include_${window}`) === "on";
  let breath_points_ms: number[] = [];
  let swell_cues_ms: number[] = [];
  try {
    breath_points_ms = parseCommaSeparatedInts(
      String(formData.get(`${window}_breath_points_ms`) ?? ""),
    );
    swell_cues_ms = parseCommaSeparatedInts(
      String(formData.get(`${window}_swell_cues_ms`) ?? ""),
    );
  } catch (e) {
    throw e;
  }
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
    breath_points_ms,
    swell_cues_ms,
  };
}

function parseVersion(
  formData: FormData,
  window: TimeWindow,
): ReturnType<typeof parseVersionFields> {
  return parseVersionFields(formData, window);
}

function asL10nOrEmpty(text: string): Record<string, string> {
  return text ? { en: text } : {};
}

async function syncVersions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  revisionId: string,
  day: ReturnType<typeof parseVersion>,
  night: ReturnType<typeof parseVersion>,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
        if (error) return serverActionError(error.message);
      }
      continue;
    }
    if (!data.narration_asset_id) {
      return serverActionError(`${window}: narration asset required`);
    }
    const { data: narration, error: narrErr } = await supabase
      .from("audio_assets")
      .select("duration_ms")
      .eq("id", data.narration_asset_id)
      .maybeSingle();
    if (narrErr) return serverActionError(narrErr.message);
    const durationMs = Number(narration?.duration_ms ?? 0);
    const breath = normalizeTimingMsList(
      data.breath_points_ms,
      durationMs,
      `${window} breath points`,
    );
    if (!Array.isArray(breath)) return serverActionError(breath.error);
    const swell = normalizeTimingMsList(
      data.swell_cues_ms,
      durationMs,
      `${window} swell cues`,
    );
    if (!Array.isArray(swell)) return serverActionError(swell.error);

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
          breath_points_ms: breath,
          swell_cues_ms: swell,
        })
        .eq("id", data.version_id);
      if (error) return serverActionError(error.message);
    } else {
      const { error } = await supabase.from("revision_versions").insert({
        revision_id: revisionId,
        language: "en",
        time_window: window,
        narration_asset_id: data.narration_asset_id,
        transcript: data.transcript,
        vtt: data.vtt,
        other_time_hint: asL10nOrEmpty(data.other_time_hint),
        breath_points_ms: breath,
        swell_cues_ms: swell,
      });
      if (error) return serverActionError(error.message);
    }
  }
  return { ok: true };
}

export async function createRevision(formData: FormData) {
  const auth = await requireRevisionWriter();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;
  const groveId = String(formData.get("grove_id") ?? "");
  const fragmentId = String(formData.get("fragment_id") ?? "");
  const isFirst = formData.get("is_first") === "1";
  const changeKindRaw = String(formData.get("change_kind") ?? "").trim();
  const changeNote =
    String(formData.get("change_note") ?? "").trim() || null;
  const changeTeaserEn = String(formData.get("change_teaser_en") ?? "").trim();

  if (!groveId || !fragmentId) {
    return serverActionError("grove and fragment required");
  }

  let changeKind: ChangeKind;
  if (isFirst) {
    changeKind = "contingency";
  } else {
    if (changeKindRaw !== "contingency" && changeKindRaw !== "correction") {
      return serverActionError("change_kind required");
    }
    changeKind = changeKindRaw;
  }

  let day: ReturnType<typeof parseVersion>;
  let night: ReturnType<typeof parseVersion>;
  try {
    day = parseVersion(formData, "day");
    night = parseVersion(formData, "night");
  } catch (e) {
    return serverActionError(
      e instanceof Error ? e.message : "invalid breath or swell points",
    );
  }
  if (!day.include && !night.include) {
    return serverActionError("at least one of Day or Night is required");
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
  if (error) return serverActionError(error.message);
  const revisionId = data.id as string;

  const synced = await syncVersions(supabase, revisionId, day, night);
  if (!synced.ok) return synced;

  const base = revisionsBase(groveId, fragmentId);
  revalidatePath(base);
  revalidatePath(`/story/groves/${groveId}`);
  return { ok: true as const, href: saveHref(`${base}/${revisionId}`) };
}

export async function updateRevision(formData: FormData) {
  const auth = await requireRevisionWriter();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const groveId = String(formData.get("grove_id") ?? "");
  const fragmentId = String(formData.get("fragment_id") ?? "");
  const revisionId = String(formData.get("revision_id") ?? "");
  const isFirst = formData.get("is_first") === "1";
  const changeKindRaw = String(formData.get("change_kind") ?? "").trim();
  const changeNote =
    String(formData.get("change_note") ?? "").trim() || null;
  const changeTeaserEn = String(formData.get("change_teaser_en") ?? "").trim();

  if (!groveId || !fragmentId || !revisionId) {
    return serverActionError("grove, fragment and revision required");
  }

  const { data: existing, error: loadErr } = await supabase
    .from("fragment_revisions")
    .select("id, status, revision_no")
    .eq("id", revisionId)
    .maybeSingle();
  if (loadErr) return serverActionError(loadErr.message);
  if (!existing) return serverActionError("revision not found");
  if (existing.status !== "draft") {
    return serverActionError("only draft revisions can be edited");
  }

  let changeKind: ChangeKind;
  if (isFirst || existing.revision_no === 1) {
    changeKind = "contingency";
  } else {
    if (changeKindRaw !== "contingency" && changeKindRaw !== "correction") {
      return serverActionError("change_kind required");
    }
    changeKind = changeKindRaw;
  }

  let day: ReturnType<typeof parseVersion>;
  let night: ReturnType<typeof parseVersion>;
  try {
    day = parseVersion(formData, "day");
    night = parseVersion(formData, "night");
  } catch (e) {
    return serverActionError(
      e instanceof Error ? e.message : "invalid breath or swell points",
    );
  }
  if (!day.include && !night.include) {
    return serverActionError("at least one of Day or Night is required");
  }

  const { error } = await supabase
    .from("fragment_revisions")
    .update({
      change_kind: changeKind,
      change_note: changeNote,
      change_teaser: asL10nOrEmpty(changeTeaserEn),
    })
    .eq("id", revisionId);
  if (error) return serverActionError(error.message);

  const synced = await syncVersions(supabase, revisionId, day, night);
  if (!synced.ok) return synced;

  const base = revisionsBase(groveId, fragmentId);
  revalidatePath(base);
  revalidatePath(`${base}/${revisionId}`);
  revalidatePath(`/story/groves/${groveId}`);
  return { ok: true as const, href: saveHref(`${base}/${revisionId}`) };
}

export async function deleteDraftRevision(formData: FormData) {
  const { supabase, staff } = await requireRevisionWriterOrThrow();
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