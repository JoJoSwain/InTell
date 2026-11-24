"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditRegions, isActiveStaff, loadStaff } from "@/lib/staff";
import {
  type ActionAuthResult,
  saveHref,
  serverActionError,
} from "@/lib/server-action-result";

async function requireEditor(): Promise<
  ActionAuthResult<{ supabase: Awaited<ReturnType<typeof createClient>> }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canEditRegions(staff.role)) {
    return serverActionError("editor required");
  }
  return { ok: true, supabase };
}

export async function saveRegion(formData: FormData) {
  const auth = await requireEditor();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/Denver").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const boundsGeoJson = String(formData.get("bounds") ?? "").trim();

  if (!name || !slug || Number.isNaN(lat) || Number.isNaN(lng)) {
    return serverActionError("name, slug, lat and lng are required");
  }

  // PostGIS geography via RPC-free WKT cast in SQL expression
  const sunWkt = `POINT(${lng} ${lat})`;
  let boundsWkt: string | null = null;
  if (boundsGeoJson) {
    try {
      const geo = JSON.parse(boundsGeoJson) as {
        type?: string;
        coordinates?: unknown;
      };
      if (geo.type !== "Polygon" || !Array.isArray(geo.coordinates)) {
        return serverActionError("bounds must be a GeoJSON Polygon");
      }
      // Store raw GeoJSON text; convert via ST_GeomFromGeoJSON in a small RPC-free path:
      // use PostgREST won't cast easily — call via rpc if available, else skip bounds on create.
      boundsWkt = JSON.stringify(geo);
    } catch {
      return serverActionError("bounds must be valid GeoJSON Polygon JSON");
    }
  }

  if (id) {
    const { error } = await supabase.rpc("fn_admin_upsert_region", {
      p_id: id,
      p_name: name,
      p_slug: slug,
      p_timezone: timezone,
      p_sun_wkt: sunWkt,
      p_bounds_geojson: boundsWkt,
    });
    if (error) return serverActionError(error.message);
    revalidatePath("/regions");
    revalidatePath(`/regions/${id}`);
    return { ok: true as const, href: saveHref(`/regions/${id}`) };
  }

  const { data, error } = await supabase.rpc("fn_admin_upsert_region", {
    p_id: null,
    p_name: name,
    p_slug: slug,
    p_timezone: timezone,
    p_sun_wkt: sunWkt,
    p_bounds_geojson: boundsWkt,
  });
  if (error) return serverActionError(error.message);
  const newId = data as string;
  revalidatePath("/regions");
  return { ok: true as const, href: saveHref(`/regions/${newId}`) };
}