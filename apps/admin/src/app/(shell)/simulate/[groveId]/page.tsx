import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canViewSound, isActiveStaff, loadStaff } from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { ListeningSimulator } from "@/components/simulate/simulator";
import { loadSimulatorData } from "@/lib/simulate/loadSimulatorData";

export default async function SimulatePage({
  params,
}: {
  params: Promise<{ groveId: string }>;
}) {
  const { groveId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewSound(staff.role)) redirect("/no-access");

  const { data: grove } = await supabase
    .from("groves")
    .select("id, name, slug")
    .eq("id", groveId)
    .maybeSingle();
  if (!grove) notFound();

  const loaded = await loadSimulatorData(groveId);
  if (!loaded.ok) {
    return (
      <main className="px-8 py-10">
        <h1 className="font-serif text-2xl font-semibold">Listening Simulator</h1>
        <p className="mt-4 text-sm text-destructive" role="alert">
          {loaded.error}
        </p>
      </main>
    );
  }

  return (
    <ListeningSimulator
      groveId={grove.id}
      groveName={l10nEn(grove.name) || grove.slug}
      initialMode={loaded.mode}
      packError={loaded.packError}
      worldJson={loaded.worldJson}
      origin={loaded.origin}
      breathByFragment={loaded.breathByFragment}
      swellByFragment={loaded.swellByFragment}
      assets={loaded.assets}
    />
  );
}
