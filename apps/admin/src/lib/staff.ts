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
