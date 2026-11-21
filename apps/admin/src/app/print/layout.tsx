import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isActiveStaff, loadStaff } from "@/lib/staff";

/** Minimal layout: staff gate, no sidebar (M3c answer 17). */
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  return (
    <div className="min-h-screen bg-white text-black">{children}</div>
  );
}
