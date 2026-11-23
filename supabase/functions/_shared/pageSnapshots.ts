export type SnapshotRow = {
  entity: string;
  entity_id: string;
  data: unknown;
  published_at: string;
};

type SnapshotQuery = {
  select: (cols: string) => SnapshotQuery;
  eq: (col: string, value: string) => SnapshotQuery;
  order: (col: string, opts: { ascending: boolean }) => SnapshotQuery;
  range: (
    from: number,
    to: number,
  ) => Promise<{ data: SnapshotRow[] | null; error: { message: string } | null }>;
};

type SnapshotClient = {
  from: (table: string) => SnapshotQuery;
};

/**
 * Page through published_snapshots for one entity.
 * PostgREST caps a single response at max_rows (1000 in config.toml).
 */
export async function pagePublishedSnapshots(
  supabase: SnapshotClient,
  entity: string,
  opts?: { pageSize?: number },
): Promise<SnapshotRow[]> {
  const pageSize = opts?.pageSize ?? 1000;
  if (!(pageSize > 0)) throw new Error("pageSize must be positive");
  const out: SnapshotRow[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("published_snapshots")
      .select("entity, entity_id, data, published_at")
      .eq("entity", entity)
      .order("entity_id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`page ${entity} snapshots: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
