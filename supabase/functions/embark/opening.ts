type OpeningRow = {
  opening_lat: number | null;
  opening_lng: number | null;
};

type OpeningQuery = {
  select: (cols: string) => OpeningQuery;
  eq: (col: string, value: string | boolean) => OpeningQuery;
  not: (col: string, op: string, value: null) => OpeningQuery;
  order: (col: string, opts: { ascending: boolean }) => OpeningQuery;
  limit: (n: number) => OpeningQuery;
  maybeSingle: () => Promise<{
    data: OpeningRow | null;
    error: { message: string } | null;
  }>;
};

type OpeningClient = {
  from: (table: string) => OpeningQuery;
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
  if (
    data?.opening_lat === null ||
    data?.opening_lat === undefined ||
    data?.opening_lng === null ||
    data?.opening_lng === undefined
  ) {
    return null;
  }
  return { lat: data.opening_lat, lng: data.opening_lng };
}
