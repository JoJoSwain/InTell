import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditRegions, isActiveStaff, loadStaff } from "@/lib/staff";
import { Button } from "@/components/ui/button";

type RegionRow = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
};

export default async function RegionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data: regions, error } = await supabase
    .from("regions")
    .select("id, slug, name, timezone")
    .order("name");

  const editable = canEditRegions(staff.role);

  return (
    <main className="px-8 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Regions</h1>
          <p className="mt-2 text-textMuted">
            Timezone and Day/Night sun reference for each region pack.
          </p>
        </div>
        {editable ? (
          <Button asChild>
            <Link href="/regions/new">New region</Link>
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {((regions ?? []) as RegionRow[]).map((r) => (
          <li key={r.id} className="flex items-center justify-between py-3">
            <div>
              <Link
                href={`/regions/${r.id}`}
                className="font-medium text-primary hover:underline"
              >
                {r.name}
              </Link>
              <p className="text-sm text-textMuted">
                {r.slug} · {r.timezone}
              </p>
            </div>
          </li>
        ))}
        {(regions ?? []).length === 0 ? (
          <li className="py-6 text-sm text-textMuted">No regions yet.</li>
        ) : null}
      </ul>
    </main>
  );
}
