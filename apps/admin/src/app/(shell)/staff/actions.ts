"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canManageStaff,
  isActiveStaff,
  loadStaff,
  type StaffRole,
} from "@/lib/staff";

const ROLES: StaffRole[] = [
  "admin",
  "editor",
  "writer",
  "sound",
  "moderator",
  "viewer",
];

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canManageStaff(staff.role)) {
    throw new Error("admin required");
  }
  return { supabase, userId: user.id };
}

async function callInviteStaff(
  supabase: Awaited<ReturnType<typeof createClient>>,
  body: Record<string, unknown>,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("not signed in");

  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const res = await fetch(`${base}/functions/v1/invite-staff`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    detail?: string;
  };
  if (!res.ok) {
    throw new Error(json.detail ?? json.error ?? `invite-staff ${res.status}`);
  }
}

export async function inviteStaff(formData: FormData) {
  const { supabase } = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const role = String(formData.get("role") ?? "writer") as StaffRole;
  if (!email || !displayName || !ROLES.includes(role)) {
    throw new Error("email, display name and role are required");
  }
  await callInviteStaff(supabase, {
    action: "invite",
    email,
    displayName,
    role,
  });
  revalidatePath("/staff");
}

export async function deactivateStaff(formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("userId required");
  await callInviteStaff(supabase, { action: "deactivate", userId });
  revalidatePath("/staff");
}

export async function reactivateStaff(formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("userId required");
  await callInviteStaff(supabase, { action: "reactivate", userId });
  revalidatePath("/staff");
}

export async function updateStaffRow(formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const role = String(formData.get("role") ?? "") as StaffRole;
  if (!userId || !displayName || !ROLES.includes(role)) {
    throw new Error("userId, display name and role are required");
  }
  const { error } = await supabase
    .from("staff")
    .update({ display_name: displayName, role })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/staff");
}
