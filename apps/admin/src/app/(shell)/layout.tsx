import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isActiveStaff, loadStaff } from "@/lib/staff";
import { ShellSidebar } from "@/components/shell-sidebar";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) {
    redirect("/no-access");
  }

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <ShellSidebar role={staff.role} displayName={staff.display_name} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
