import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canViewSound, isActiveStaff, loadStaff } from "@/lib/staff";
import { l10nEn } from "@/lib/geo";

export default async function AmbienceProfilesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewSound(staff.role)) redirect("/no-access");

  const { data: profiles } = await supabase
    .from("ambience_profiles")
    .select("id, slug, name, description, density, region_id, status")
    .order("slug");

  const { data: regions } = await supabase.from("regions").select("id, name");
  const regionName = new Map(
    ((regions ?? []) as { id: string; name: unknown }[]).map((r) => [
      r.id,
      l10nEn(r.name),
    ]),
  );

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">Ambience profiles</h1>
      <p className="mt-2 text-sm text-textMuted">
        Day and Night layers per profile. Density drives live weighting on site.
      </p>
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {((profiles ?? []) as {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          density: number;
          region_id: string | null;
          status: string;
        }[]).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <Link
                href={`/sound/profiles/${p.id}`}
                className="font-medium text-primary hover:underline"
                aria-label={`Open profile ${p.slug}`}
              >
                {p.slug}
              </Link>
              <p className="text-sm text-textMuted">
                {p.name}
                {p.region_id ? ` · ${regionName.get(p.region_id) ?? ""}` : ""}
                {` · density ${p.density}`}
                {` · ${p.status}`}
              </p>
            </div>
          </li>
        ))}
        {(profiles ?? []).length === 0 ? (
          <li className="py-4 text-sm text-textMuted">No profiles yet.</li>
        ) : null}
      </ul>
    </main>
  );
}