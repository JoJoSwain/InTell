"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canWriteMedia, isActiveStaff, loadStaff } from "@/lib/staff";

async function requireMediaWriter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canWriteMedia(staff.role)) {
    throw new Error("media write required");
  }
  return { supabase, userId: user.id };
}

export async function updateImageAsset(formData: FormData) {
  const { supabase } = await requireMediaWriter();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const altEn = String(formData.get("alt_en") ?? "").trim();
  if (!id || !title || !altEn) throw new Error("id, title and alt text required");

  const { error } = await supabase
    .from("image_assets")
    .update({ title, alt_text: { en: altEn } })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/media/images");
  revalidatePath(`/media/images/${id}`);
  redirect(`/media/images/${id}`);
}

export type InsertImagePayload = {
  title: string;
  alt_en: string;
  sha256: string;
  ext: string;
  bytes: number;
  width: number;
  height: number;
  staging_path: string;
};

export async function insertImageAssetRow(payload: InsertImagePayload) {
  const { supabase, userId } = await requireMediaWriter();
  const { data: existing } = await supabase
    .from("image_assets")
    .select("id, title")
    .eq("sha256", payload.sha256)
    .maybeSingle();
  if (existing) {
    return {
      duplicate: true as const,
      id: existing.id as string,
      title: existing.title as string,
    };
  }

  const { data, error } = await supabase
    .from("image_assets")
    .insert({
      title: payload.title,
      alt_text: { en: payload.alt_en },
      sha256: payload.sha256,
      ext: payload.ext,
      bytes: payload.bytes,
      width: payload.width,
      height: payload.height,
      staging_path: payload.staging_path,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/media/images");
  return { duplicate: false as const, id: data.id as string };
}
