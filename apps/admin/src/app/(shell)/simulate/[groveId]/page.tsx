import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canViewSound, isActiveStaff, loadStaff } from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { ListeningSimulator } from "@/components/simulate/simulator";

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

  return (
    <ListeningSimulator
      groveId={grove.id}
      groveName={l10nEn(grove.name) || grove.slug}
    />
  );
}
