import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditRegions, isActiveStaff, loadStaff } from "@/lib/staff";
import { RegionForm } from "../region-form";

export default async function NewRegionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canEditRegions(staff.role)) {
    redirect("/regions");
  }

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">New region</h1>
      <p className="mt-2 text-textMuted">
        Enter a sun-reference point as lat/lng. Optional bounds as GeoJSON
        Polygon (no map required).
      </p>
      <div className="mt-8 max-w-xl">
        <RegionForm />
      </div>
    </main>
  );
}
