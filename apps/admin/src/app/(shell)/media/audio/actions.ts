"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canWriteMedia, isActiveStaff, loadStaff } from "@/lib/staff";
import {
  type ActionAuthResult,
  saveHref,
  serverActionError,
} from "@/lib/server-action-result";

async function requireMediaWriter(): Promise<
  ActionAuthResult<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canWriteMedia(staff.role)) {
    return serverActionError("media write required");
  }
  return { ok: true, supabase, userId: user.id };
}

export async function updateAudioAsset(formData: FormData) {
  const auth = await requireMediaWriter();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (!id || !title) return serverActionError("id and title required");

  const { error } = await supabase
    .from("audio_assets")
    .update({ title, tags })
    .eq("id", id);
  if (error) return serverActionError(error.message);
  revalidatePath("/media/audio");
  revalidatePath(`/media/audio/${id}`);
  return { ok: true as const, href: saveHref(`/media/audio/${id}`) };
}

export type InsertAudioPayload = {
  title: string;
  kind: string;
  tags: string[];
  sha256: string;
  ext: string;
  bytes: number;
  duration_ms: number;
  channels: number;
  sample_rate: number;
  bitrate_kbps: number | null;
  loudness_lufs: number | null;
  true_peak_dbtp: number | null;
  max_short_term_lufs: number | null;
  crest_factor_db: number | null;
  safe_for_walkers_checked: boolean;
  staging_path: string;
};

export async function insertAudioAssetRow(payload: InsertAudioPayload) {
  const auth = await requireMediaWriter();
  if (!auth.ok) throw new Error(auth.error);
  const { supabase, userId } = auth;
  const { data: existing } = await supabase
    .from("audio_assets")
    .select("id, title")
    .eq("sha256", payload.sha256)
    .maybeSingle();
  if (existing) {
    return { duplicate: true as const, id: existing.id as string, title: existing.title as string };
  }

  const { data, error } = await supabase
    .from("audio_assets")
    .insert({
      title: payload.title,
      kind: payload.kind as
        | "narration"
        | "sfx_oneshot"
        | "sfx_bed"
        | "music_stem"
        | "music_moment"
        | "beacon"
        | "voice_cue"
        | "growth_cue",
      tags: payload.tags,
      sha256: payload.sha256,
      ext: payload.ext,
      bytes: payload.bytes,
      duration_ms: payload.duration_ms,
      channels: payload.channels,
      sample_rate: payload.sample_rate,
      bitrate_kbps: payload.bitrate_kbps,
      loudness_lufs: payload.loudness_lufs,
      true_peak_dbtp: payload.true_peak_dbtp,
      max_short_term_lufs: payload.max_short_term_lufs,
      crest_factor_db: payload.crest_factor_db,
      safe_for_walkers_checked: payload.safe_for_walkers_checked,
      staging_path: payload.staging_path,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/media/audio");
  return { duplicate: false as const, id: data.id as string };
}