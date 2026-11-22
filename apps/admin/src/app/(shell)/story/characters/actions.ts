"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageCharacters, isActiveStaff, loadStaff } from "@/lib/staff";
import { asL10n } from "@/lib/geo";
import { saveHref } from "@/lib/server-action-result";

async function requireCharacterWriter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canManageCharacters(staff.role)) {
    throw new Error("writer required");
  }
  return supabase;
}

export async function saveCharacter(formData: FormData) {
  const supabase = await requireCharacterWriter();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const publicName = String(formData.get("public_name_en") ?? "").trim();
  const publicIntro = String(formData.get("public_intro_en") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const portrait = String(formData.get("portrait_image_id") ?? "").trim() || null;
  const homeGrove =
    String(formData.get("home_grove_id") ?? "").trim() || null;

  if (!name) throw new Error("name required");

  const payload = {
    name,
    public_name: asL10n(publicName || name),
    public_intro: asL10n(publicIntro),
    notes,
    portrait_image_id: portrait,
    home_grove_id: homeGrove,
  };

  if (id) {
    // Writers may edit all fields except status (F1 guard).
    const { error } = await supabase
      .from("characters")
      .update(payload)
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/story/characters");
    revalidatePath(`/story/characters/${id}`);
    return { ok: true as const, href: saveHref(`/story/characters/${id}`) };
  }

  const { data, error } = await supabase
    .from("characters")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/story/characters");
  return {
    ok: true as const,
    href: saveHref(`/story/characters/${data.id as string}`),
  };
}
