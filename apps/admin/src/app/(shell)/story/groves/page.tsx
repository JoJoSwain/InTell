import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditStory, isActiveStaff, loadStaff } from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import {
  releaseBadgeKind,
  UnreleasedBadge,
} from "@/components/unreleased-badge";
import { Button } from "@/components/ui/button";

type GroveRow = {
  id: string;
  slug: string;
  name: unknown;
  status: string;
};

export default async function GrovesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data: groves, error } = await supabase
    .from("groves")
    .select("id, slug, name, status")
    .order("slug");

  const { data: unreleased } = await supabase.rpc("fn_unreleased", {
    p_grove_id: null,
  });
  const unreleasedIds = new Set(
    ((unreleased ?? []) as { entity: string; entity_id: string }[])
      .filter((r) => r.entity === "grove")
      .map((r) => r.entity_id),
  );

  const { data: snapshots } = await supabase
    .from("published_snapshots")
    .select("entity_id")
    .eq("entity", "grove");
  const publishedIds = new Set(
    (snapshots ?? []).map((s) => s.entity_id as string),
  );

  const editable = canEditStory(staff.role);

  return (
    <main className="px-8 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Groves</h1>
          <p className="mt-2 text-textMuted">
            Story places, fragments, prerequisites and markers.
          </p>
        </div>
        {editable ? (
          <Button asChild>
            <Link href="/story/groves/new">New grove</Link>
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {((groves ?? []) as GroveRow[]).map((g) => (
          <li
            key={g.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div>
              <Link
                href={`/story/groves/${g.id}`}
                className="font-medium text-primary hover:underline"
              >
                {l10nEn(g.name) || g.slug}
              </Link>
              <p className="text-sm text-textMuted">{g.slug}</p>
            </div>
            <UnreleasedBadge
              kind={releaseBadgeKind(g.id, unreleasedIds, publishedIds)}
            />
          </li>
        ))}
        {(groves ?? []).length === 0 ? (
          <li className="py-6 text-sm text-textMuted">No groves yet.</li>
        ) : null}
      </ul>
    </main>
  );
}
