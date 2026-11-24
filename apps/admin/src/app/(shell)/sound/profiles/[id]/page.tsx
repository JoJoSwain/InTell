import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canEditSound,
  canViewSound,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { saveAmbienceProfile } from "../../actions";

type Props = { params: Promise<{ id: string }> };

export default async function AmbienceProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewSound(staff.role)) redirect("/no-access");

  const { data: profile } = await supabase
    .from("ambience_profiles")
    .select("id, slug, name, description, density, region_id")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const { data: layers } = await supabase
    .from("ambience_layers")
    .select("id, name, kind, time_window")
    .eq("profile_id", id)
    .order("time_window")
    .order("name");

  const editable = canEditSound(staff.role);

  return (
    <main className="px-8 py-10">
      <p className="text-sm text-textMuted">
        <Link href="/sound/profiles" className="text-primary underline">
          ← Profiles
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-3xl font-semibold">
        {profile.slug as string}
      </h1>
      <p className="mt-2 text-textMuted">{profile.name as string}</p>

      {editable ? (
        <ServerActionForm action={saveAmbienceProfile} className="mt-8 max-w-xl space-y-4">
          <input type="hidden" name="id" value={id} />
          <label className="block text-sm">
            <span className="text-textMuted">Density</span>
            <input
              name="density"
              type="number"
              step="0.01"
              min={0}
              defaultValue={String(profile.density)}
              aria-label="Profile density"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Description</span>
            <textarea
              name="description"
              rows={2}
              defaultValue={(profile.description as string | null) ?? ""}
              aria-label="Profile description"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <ServerActionSubmit aria-label="Save profile">Save</ServerActionSubmit>
        </ServerActionForm>
      ) : null}

      <section className="mt-12" aria-labelledby="layers-heading">
        <h2 id="layers-heading" className="font-serif text-xl font-semibold">
          Layers
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {((layers ?? []) as {
            id: string;
            name: string;
            kind: string;
            time_window: string;
          }[]).map((layer) => (
            <li key={layer.id} className="py-3">
              <Link
                href={`/sound/profiles/${id}/layers/${layer.id}`}
                className="text-primary hover:underline"
                aria-label={`Edit layer ${layer.name}`}
              >
                {layer.time_window} · {layer.kind} · {layer.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}