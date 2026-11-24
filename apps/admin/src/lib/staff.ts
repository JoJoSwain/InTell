import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffRole =
  | "admin"
  | "editor"
  | "writer"
  | "sound"
  | "moderator"
  | "viewer";

export type StaffRow = {
  user_id: string;
  display_name: string;
  role: StaffRole;
  active: boolean;
};

export async function loadStaff(
  supabase: SupabaseClient,
  userId: string,
): Promise<StaffRow | null> {
  const { data, error } = await supabase
    .from("staff")
    .select("user_id, display_name, role, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as StaffRow;
}

export function isActiveStaff(staff: StaffRow | null): staff is StaffRow {
  return Boolean(staff?.active);
}

export function canManageStaff(role: StaffRole): boolean {
  return role === "admin";
}

export function canViewAudit(role: StaffRole): boolean {
  return role === "admin" || role === "editor";
}

export function canEditRegions(role: StaffRole): boolean {
  return role === "admin" || role === "editor";
}

export function canEditStory(role: StaffRole): boolean {
  return role === "admin" || role === "editor";
}

export function canWriteMedia(role: StaffRole): boolean {
  return (
    role === "writer" ||
    role === "sound" ||
    role === "editor" ||
    role === "admin"
  );
}

export function canWriteStoryNotes(role: StaffRole): boolean {
  return role === "writer" || role === "editor" || role === "admin";
}

export function canManageCharacters(role: StaffRole): boolean {
  return role === "writer" || role === "editor" || role === "admin";
}

/** Writers draft revisions; editors publish via releases. */
export function canWriteRevisions(role: StaffRole): boolean {
  return role === "writer" || role === "editor" || role === "admin";
}

/** Publish / unpublish / schedule — editor or admin only. */
export function canPublishRelease(role: StaffRole): boolean {
  return role === "editor" || role === "admin";
}

/** Preview edge: staff who can read staging buckets (DATA_MODEL §13). */
export function canPreviewRelease(role: StaffRole): boolean {
  return (
    role === "writer" ||
    role === "sound" ||
    role === "editor" ||
    role === "admin"
  );
}

/** Sound design authoring — profiles, zones, music, grove cues. */
export function canEditSound(role: StaffRole): boolean {
  return role === "sound" || role === "editor" || role === "admin";
}

/** Any signed-in staff may view sound routes. */
export function canViewSound(role: StaffRole): boolean {
  return (
    role === "viewer" ||
    role === "moderator" ||
    role === "writer" ||
    role === "sound" ||
    role === "editor" ||
    role === "admin"
  );
}
