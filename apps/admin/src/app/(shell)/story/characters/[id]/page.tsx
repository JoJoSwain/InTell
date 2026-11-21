import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canManageCharacters,
  canPublishRelease,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { UnpublishButton } from "@/components/unpublish-button";
import { saveCharacter } from "../actions";

type Props = { params: Promise<{ id: string }> };

export default async function CharacterDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data: character } = await supabase
    .from("characters")
    .select(
      "id, name, public_name, public_intro, notes, portrait_image_id, home_grove_id, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (!character) notFound();

  const { data: images } = await supabase
    .from("image_assets")
    .select("id, title")
    .order("title");

  // A4: every grove except unpublished (draft + published), all regions
  const { data: groves } = await supabase
    .from("groves")
    .select("id, name, status")
    .neq("status", "unpublished")
    .order("slug");

  const editable = canManageCharacters(staff.role);
  const canUnpublish =
    canPublishRelease(staff.role) && character.status === "published";

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">
        {l10nEn(character.public_name) || character.name}
      </h1>
      <p className="mt-2 text-textMuted">
        {character.name} · {character.status}
      </p>
      {canUnpublish ? (
        <div className="mt-4">
          <UnpublishButton entity="character" id={character.id} />
        </div>
      ) : null}

      {editable ? (
        <form action={saveCharacter} className="mt-8 max-w-xl space-y-4">
          <input type="hidden" name="id" value={character.id} />
          <label className="block text-sm">
            <span className="text-textMuted">Internal name</span>
            <input
              name="name"
              required
              defaultValue={character.name}
              aria-label="Internal name"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Public name (en)</span>
            <input
              name="public_name_en"
              defaultValue={l10nEn(character.public_name)}
              aria-label="Public name"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Back story (en)</span>
            <textarea
              name="public_intro_en"
              rows={4}
              defaultValue={l10nEn(character.public_intro)}
              aria-label="Back story"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">
              Portrait (required to release)
            </span>
            <select
              name="portrait_image_id"
              defaultValue={character.portrait_image_id ?? ""}
              aria-label="Portrait image"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="">(none)</option>
              {((images ?? []) as { id: string; title: string }[]).map((img) => (
                <option key={img.id} value={img.id}>
                  {img.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">
              Home grove (required to release)
            </span>
            <select
              name="home_grove_id"
              defaultValue={character.home_grove_id ?? ""}
              aria-label="Home grove"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="">(none)</option>
              {(
                (groves ?? []) as {
                  id: string;
                  name: unknown;
                  status: string;
                }[]
              ).map((g) => (
                <option key={g.id} value={g.id}>
                  {l10nEn(g.name) || g.id.slice(0, 8)} ({g.status})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Notes (Story Notes)</span>
            <textarea
              name="notes"
              rows={6}
              defaultValue={character.notes ?? ""}
              aria-label="Character notes"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <p className="text-xs text-textMuted">
            Status is not editable here (F1 guard).
          </p>
          <Button type="submit">Save character</Button>
        </form>
      ) : (
        <p className="mt-6 whitespace-pre-wrap text-sm">
          {character.notes || "(no notes)"}
        </p>
      )}
    </main>
  );
}
