import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canEditSound,
  canViewSound,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { ZoneEditor } from "./zone-editor";

async function fetchBoundary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: "ambience" | "music",
  id: string,
): Promise<string> {
  const scope = kind === "ambience" ? "ambience_zone" : "music_zone";
  const { data, error } = await supabase.rpc("fn_pack_geog_geojson", {
    p_scope: scope,
    p_id: id,
  });
  if (error || !data) return "";
  return JSON.stringify(data, null, 2);
}

export default async function SoundZonesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewSound(staff.role)) redirect("/no-access");

  const [{ data: ambZones }, { data: musicZones }, { data: profiles }, { data: regions }] =
    await Promise.all([
      supabase
        .from("ambience_zones")
        .select("id, name, priority, edge_fade_m, profile_id, region_id, status")
        .order("name"),
      supabase
        .from("music_zones")
        .select("id, name, priority, edge_fade_m, region_id, status")
        .order("name"),
      supabase.from("ambience_profiles").select("id, slug"),
      supabase.from("regions").select("id, name"),
    ]);

  const profileSlug = new Map(
    ((profiles ?? []) as { id: string; slug: string }[]).map((p) => [
      p.id,
      p.slug,
    ]),
  );
  const regionName = new Map(
    ((regions ?? []) as { id: string; name: unknown }[]).map((r) => [
      r.id,
      l10nEn(r.name),
    ]),
  );

  const ambWithBounds = await Promise.all(
    (
      (ambZones ?? []) as {
        id: string;
        name: string;
        priority: number;
        edge_fade_m: number;
        profile_id: string;
        region_id: string;
        status: string;
      }[]
    ).map(async (z) => ({
      ...z,
      boundaryJson: await fetchBoundary(supabase, "ambience", z.id),
      profileSlug: profileSlug.get(z.profile_id) ?? z.profile_id.slice(0, 8),
      regionLabel: regionName.get(z.region_id) ?? "",
    })),
  );

  const musicWithBounds = await Promise.all(
    (
      (musicZones ?? []) as {
        id: string;
        name: string;
        priority: number;
        edge_fade_m: number;
        region_id: string;
        status: string;
      }[]
    ).map(async (z) => ({
      ...z,
      boundaryJson: await fetchBoundary(supabase, "music", z.id),
      regionLabel: regionName.get(z.region_id) ?? "",
    })),
  );

  const editable = canEditSound(staff.role);

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">Sound zones</h1>
      <p className="mt-2 text-sm text-textMuted">
        Ambience and music zone polygons, priority and edge fade.
      </p>

      <section className="mt-10" aria-labelledby="amb-zones-heading">
        <h2 id="amb-zones-heading" className="font-serif text-xl font-semibold">
          Ambience zones
        </h2>
        <div className="mt-4 space-y-8">
          {ambWithBounds.map((z) => (
            <ZoneEditor
              key={z.id}
              kind="ambience"
              zoneId={z.id}
              name={z.name}
              priority={z.priority}
              edgeFadeM={z.edge_fade_m}
              boundaryJson={z.boundaryJson}
              meta={`${z.profileSlug} · ${z.regionLabel} · ${z.status}`}
              editable={editable}
            />
          ))}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="music-zones-heading">
        <h2 id="music-zones-heading" className="font-serif text-xl font-semibold">
          Music zones
        </h2>
        <div className="mt-4 space-y-8">
          {musicWithBounds.map((z) => (
            <ZoneEditor
              key={z.id}
              kind="music"
              zoneId={z.id}
              name={z.name}
              priority={z.priority}
              edgeFadeM={z.edge_fade_m}
              boundaryJson={z.boundaryJson}
              meta={`${z.regionLabel} · ${z.status}`}
              editable={editable}
            />
          ))}
        </div>
      </section>
    </main>
  );
}