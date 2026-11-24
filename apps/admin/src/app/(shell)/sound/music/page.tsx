import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canViewSound, isActiveStaff, loadStaff } from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { growthStepCountHint } from "@/lib/sound/helpers";
import type { MusicCondition } from "@intell/shared";

export default async function SoundMusicPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewSound(staff.role)) redirect("/no-access");

  const [{ data: zones }, { data: cues }] = await Promise.all([
    supabase
      .from("music_zones")
      .select("id, name, region_id, priority, status")
      .order("name"),
    supabase
      .from("music_cues")
      .select(
        "id, name, grove_id, music_zone_id, time_window, priority, status, conditions",
      )
      .order("priority", { ascending: false }),
  ]);

  const groveIds = [
    ...new Set(
      ((cues ?? []) as { grove_id: string | null }[])
        .map((c) => c.grove_id)
        .filter(Boolean),
    ),
  ] as string[];
  const { data: groves } = groveIds.length
    ? await supabase.from("groves").select("id, slug, name").in("id", groveIds)
    : { data: [] };
  const groveSlug = new Map(
    ((groves ?? []) as { id: string; slug: string; name: unknown }[]).map(
      (g) => [g.id, `${g.slug} — ${l10nEn(g.name)}`],
    ),
  );

  const zoneName = new Map(
    ((zones ?? []) as { id: string; name: string }[]).map((z) => [z.id, z.name]),
  );

  const growthByGroveWindow = new Map<string, number[]>();
  for (const cue of (cues ?? []) as {
    grove_id: string | null;
    time_window: string;
    conditions: MusicCondition;
  }[]) {
    if (!cue.grove_id) continue;
    const key = `${cue.grove_id}:${cue.time_window}`;
    const heard = cue.conditions?.heardAll?.length ?? 0;
    const list = growthByGroveWindow.get(key) ?? [];
    if (heard > 0) list.push(heard);
    growthByGroveWindow.set(key, list);
  }

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">Music</h1>
      <p className="mt-2 text-sm text-textMuted">Zones and cues with growth conditions.</p>

      <section className="mt-10" aria-labelledby="zones-heading">
        <h2 id="zones-heading" className="font-serif text-xl font-semibold">
          Music zones
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
          {((zones ?? []) as {
            id: string;
            name: string;
            priority: number;
            status: string;
          }[]).map((z) => (
            <li key={z.id} className="py-2">
              <Link href="/sound/zones" className="text-primary hover:underline">
                {z.name}
              </Link>
              <span className="text-textMuted">
                {" "}
                · priority {z.priority} · {z.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="cues-heading">
        <h2 id="cues-heading" className="font-serif text-xl font-semibold">
          Cues
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {(
            (cues ?? []) as {
              id: string;
              name: string;
              grove_id: string | null;
              music_zone_id: string | null;
              time_window: string;
              priority: number;
              status: string;
              conditions: MusicCondition;
            }[]
          ).map((cue) => {
            const growthKey = cue.grove_id
              ? `${cue.grove_id}:${cue.time_window}`
              : null;
            const hint = growthKey
              ? growthStepCountHint(growthByGroveWindow.get(growthKey) ?? [])
              : null;
            return (
              <li key={cue.id} className="py-3">
                <Link
                  href={`/sound/music/cues/${cue.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {cue.name}
                </Link>
                <p className="text-sm text-textMuted">
                  {cue.time_window} · priority {cue.priority} · {cue.status}
                  {cue.music_zone_id
                    ? ` · zone ${zoneName.get(cue.music_zone_id) ?? ""}`
                    : ""}
                  {cue.grove_id
                    ? ` · ${groveSlug.get(cue.grove_id) ?? cue.grove_id.slice(0, 8)}`
                    : ""}
                </p>
                {cue.conditions?.heardAll?.length ? (
                  <p className="text-xs text-textMuted">
                    heardAll: {cue.conditions.heardAll.length} fragment(s)
                    {hint ? ` · ${hint}` : ""}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}