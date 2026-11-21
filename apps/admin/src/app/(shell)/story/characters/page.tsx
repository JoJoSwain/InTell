import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageCharacters, isActiveStaff, loadStaff } from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import {
  releaseBadgeKind,
  UnreleasedBadge,
} from "@/components/unreleased-badge";
import { Button } from "@/components/ui/button";
import { saveCharacter } from "./actions";

type CharRow = {
  id: string;
  name: string;
  public_name: unknown;
  status: string;
};

export default async function CharactersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data: characters, error } = await supabase
    .from("characters")
    .select("id, name, public_name, status")
    .order("name");

  const { data: unreleased } = await supabase.rpc("fn_unreleased", {
    p_grove_id: null,
  });
  const unreleasedIds = new Set(
    ((unreleased ?? []) as { entity: string; entity_id: string }[])
      .filter((r) => r.entity === "character")
      .map((r) => r.entity_id),
  );
  const { data: snapshots } = await supabase
    .from("published_snapshots")
    .select("entity_id")
    .eq("entity", "character");
  const publishedIds = new Set(
    (snapshots ?? []).map((s) => s.entity_id as string),
  );

  const editable = canManageCharacters(staff.role);

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">Characters</h1>
      <p className="mt-2 text-textMuted">
        Public name, intro, portrait and private notes.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {((characters ?? []) as CharRow[]).map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div>
              <Link
                href={`/story/characters/${c.id}`}
                className="font-medium text-primary hover:underline"
              >
                {l10nEn(c.public_name) || c.name}
              </Link>
              <p className="text-sm text-textMuted">{c.name}</p>
            </div>
            <UnreleasedBadge
              kind={releaseBadgeKind(c.id, unreleasedIds, publishedIds)}
            />
          </li>
        ))}
        {(characters ?? []).length === 0 ? (
          <li className="py-6 text-sm text-textMuted">No characters yet.</li>
        ) : null}
      </ul>

      {editable ? (
        <section className="mt-10 max-w-xl">
          <h2 className="font-serif text-xl font-semibold">New character</h2>
          <form action={saveCharacter} className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="text-textMuted">Internal name</span>
              <input
                name="name"
                required
                aria-label="Internal name"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-textMuted">Public name (en)</span>
              <input
                name="public_name_en"
                aria-label="Public name"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <Button type="submit">Create</Button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
