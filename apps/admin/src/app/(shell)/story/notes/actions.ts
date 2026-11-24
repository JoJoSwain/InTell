"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canWriteStoryNotes, isActiveStaff, loadStaff } from "@/lib/staff";
import {
  type ActionAuthResult,
  saveHref,
  serverActionError,
} from "@/lib/server-action-result";

async function requireNotesWriter(): Promise<
  ActionAuthResult<{ supabase: Awaited<ReturnType<typeof createClient>> }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canWriteStoryNotes(staff.role)) {
    return serverActionError("writer required");
  }
  return { ok: true, supabase };
}

export async function saveThread(formData: FormData) {
  const auth = await requireNotesWriter();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!title) return serverActionError("title required");

  if (id) {
    const { error } = await supabase
      .from("threads")
      .update({ title, notes })
      .eq("id", id);
    if (error) return serverActionError(error.message);
  } else {
    const { error } = await supabase.from("threads").insert({ title, notes });
    if (error) return serverActionError(error.message);
  }
  revalidatePath("/story/notes");
  return { ok: true as const, href: saveHref("/story/notes") };
}