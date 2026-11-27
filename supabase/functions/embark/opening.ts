type OpeningRow = {
  opening_lat: number | null;
  opening_lng: number | null;
};

/**
 * Loose client: PostgREST's concrete builder generics do not match a
 * hand-rolled chainable query type under `deno check`.
 */
type OpeningClient = {
  // deno-lint-ignore no-explicit-any -- PostgREST generics vs chainable fake
  from: (table: string) => any;
};

/** Live grove pack opening — same point get_pack_index exposes. */
export async function lookupLiveOpening(
  supabase: OpeningClient,
  groveId: string,
): Promise<{ lat: number; lng: number } | null> {
  const { data, error } = await supabase
    .from("pack_builds")
    .select("opening_lat, opening_lng")
    .eq("scope", "grove")
    .eq("scope_id", groveId)
    .eq("live", true)
    .not("opening_lat", "is", null)
    .not("opening_lng", "is", null)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("opening lookup failed");
  const row = data as OpeningRow | null;
  if (
    row?.opening_lat === null ||
    row?.opening_lat === undefined ||
    row?.opening_lng === null ||
    row?.opening_lng === undefined
  ) {
    return null;
  }
  return { lat: row.opening_lat, lng: row.opening_lng };
}
