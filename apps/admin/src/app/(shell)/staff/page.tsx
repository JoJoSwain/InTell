import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageStaff, isActiveStaff, loadStaff } from "@/lib/staff";
import { StatusBadge } from "@/components/status-badge";
import { InviteStaffForm } from "./invite-form";
import { StaffRowActions } from "./row-actions";

type StaffListRow = {
  user_id: string;
  display_name: string;
  role: string;
  active: boolean;
};

export default async function StaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const me = await loadStaff(supabase, user.id);
  if (!isActiveStaff(me) || !canManageStaff(me.role)) {
    redirect("/");
  }

  const { data: rows, error } = await supabase
    .from("staff")
    .select("user_id, display_name, role, active")
    .order("display_name");

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">Staff</h1>
      <p className="mt-2 max-w-xl text-textMuted">
        Invite, deactivate and update roles. The last active admin cannot be
        removed.
      </p>

      <section className="mt-8 max-w-lg" aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="text-lg font-medium">
          Invite
        </h2>
        <div className="mt-3">
          <InviteStaffForm />
        </div>
      </section>

      {error ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}

      <ul className="mt-10 divide-y divide-border border-y border-border">
        {((rows ?? []) as StaffListRow[]).map((row) => (
          <li
            key={row.user_id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <p className="font-medium">{row.display_name}</p>
              <p className="text-sm text-textMuted">{row.role}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={row.active ? "published" : "retired"} />
              <StaffRowActions
                userId={row.user_id}
                displayName={row.display_name}
                role={row.role}
                active={row.active}
                isSelf={row.user_id === user.id}
              />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
