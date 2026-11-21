import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditRegions, isActiveStaff, loadStaff } from "@/lib/staff";
import { RegionForm } from "../region-form";

type Props = { params: Promise<{ id: string }> };

export default async function RegionDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data: region } = await supabase
    .from("regions")
    .select("id, name, slug, timezone, sun_reference, bounds")
    .eq("id", id)
    .maybeSingle();

  if (!region) notFound();

  // geography may arrive as GeoJSON or WKT depending on Accept; parse loosely
  let lat = 41.1;
  let lng = -111.9;
  const sun = region.sun_reference as unknown;
  if (sun && typeof sun === "object" && sun !== null && "coordinates" in sun) {
    const coords = (sun as { coordinates: number[] }).coordinates;
    lng = coords[0] ?? lng;
    lat = coords[1] ?? lat;
  }

  let boundsJson = "";
  if (region.bounds) {
    boundsJson = JSON.stringify(region.bounds, null, 2);
  }

  const editable = canEditRegions(staff.role);

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">{region.name}</h1>
      <p className="mt-2 text-textMuted">
        {region.slug} · {region.timezone}
      </p>
      {editable ? (
        <div className="mt-8 max-w-xl">
          <RegionForm
            initial={{
              id: region.id,
              name: region.name,
              slug: region.slug,
              timezone: region.timezone,
              lat,
              lng,
              boundsJson,
            }}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-textMuted">View only for your role.</p>
      )}
    </main>
  );
}
