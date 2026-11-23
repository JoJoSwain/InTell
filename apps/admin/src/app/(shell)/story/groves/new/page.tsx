import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditStory, isActiveStaff, loadStaff } from "@/lib/staff";
import { GroveForm } from "../grove-form";

export default async function NewGrovePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");
  if (!canEditStory(staff.role)) redirect("/story/groves");

  const { data: regions } = await supabase
    .from("regions")
    .select("id, name")
    .order("name");

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">New grove</h1>
      <p className="mt-2 text-textMuted">
        The outline is derived from fragments after you place them.
      </p>
      <div className="mt-8 max-w-xl">
        <GroveForm
          regions={(regions ?? []) as { id: string; name: string }[]}
          canEdit
        />
      </div>
    </main>
  );
}
