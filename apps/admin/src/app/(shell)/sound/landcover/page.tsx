import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canViewSound, isActiveStaff, loadStaff } from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { LandcoverUpload } from "@/components/sound/landcover-upload";

export default async function LandcoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewSound(staff.role)) redirect("/no-access");

  const [{ data: grids }, { data: regions }, { data: classes }] =
    await Promise.all([
      supabase
        .from("landcover_grids")
        .select("region_id, file_path, h3_resolution, source, version, generated_at")
        .order("generated_at", { ascending: false }),
      supabase.from("regions").select("id, name, slug"),
      supabase
        .from("landcover_classes")
        .select("code, name, profile_id")
        .order("code"),
    ]);

  const regionById = new Map(
    ((regions ?? []) as { id: string; name: unknown; slug: string }[]).map(
      (r) => [r.id, { name: l10nEn(r.name), slug: r.slug }],
    ),
  );

  const regionOpts = (
    (regions ?? []) as { id: string; name: unknown; slug: string }[]
  ).map((r) => ({
    id: r.id,
    name: l10nEn(r.name) || r.slug,
    slug: r.slug,
  }));

  const { data: profiles } = await supabase
    .from("ambience_profiles")
    .select("id, slug");
  const profileSlug = new Map(
    ((profiles ?? []) as { id: string; slug: string }[]).map((p) => [
      p.id,
      p.slug,
    ]),
  );

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">Landcover</h1>
      <p className="mt-2 text-sm text-textMuted">
        Grids and NLCD class → ambience profile mapping. Upload a JSON H3 grid
        below, or build binaries with{" "}
        <code className="text-xs">tools/landcover</code>.
      </p>

      <LandcoverUpload
        regions={regionOpts}
        defaultRegionId={regionOpts[0]?.id}
      />

      <section className="mt-10" aria-labelledby="grids-heading">
        <h2 id="grids-heading" className="font-serif text-xl font-semibold">
          Grids by region
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {((grids ?? []) as {
            region_id: string;
            file_path: string;
            h3_resolution: number;
            source: string;
            version: number;
            generated_at: string;
          }[]).map((g) => {
            const region = regionById.get(g.region_id);
            return (
              <li key={`${g.region_id}-${g.version}`} className="py-3 text-sm">
                <p className="font-medium">
                  {region?.name ?? g.region_id.slice(0, 8)} (v{g.version})
                </p>
                <p className="text-textMuted">
                  H3 res {g.h3_resolution} · {g.source} ·{" "}
                  {new Date(g.generated_at).toLocaleString()}
                </p>
                <p className="font-mono text-xs text-textMuted">{g.file_path}</p>
              </li>
            );
          })}
          {(grids ?? []).length === 0 ? (
            <li className="py-4 text-sm text-textMuted">No grids loaded.</li>
          ) : null}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="classes-heading">
        <h2 id="classes-heading" className="font-serif text-xl font-semibold">
          Landcover classes
        </h2>
        <table className="mt-4 w-full max-w-2xl text-sm">
          <thead>
            <tr className="border-b border-border text-left text-textMuted">
              <th className="py-2 pr-4">Code</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2">Ambience profile</th>
            </tr>
          </thead>
          <tbody>
            {((classes ?? []) as {
              code: number;
              name: string;
              profile_id: string | null;
            }[]).map((c) => (
              <tr key={c.code} className="border-b border-border">
                <td className="py-2 pr-4">{c.code}</td>
                <td className="py-2 pr-4">{c.name}</td>
                <td className="py-2">
                  {c.profile_id ? (
                    <Link
                      href={`/sound/profiles/${c.profile_id}`}
                      className="text-primary hover:underline"
                    >
                      {profileSlug.get(c.profile_id) ?? c.profile_id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-textMuted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}