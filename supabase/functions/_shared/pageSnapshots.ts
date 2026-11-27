export type SnapshotRow = {
  entity: string;
  entity_id: string;
  data: unknown;
  published_at: string;
};

/**
 * Structural client for paging. Nested so it matches PostgREST's real chain
 * (`from` → `select` → `eq` → `order` → `range`) and the unit-test fake.
 */
export type SnapshotClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, value: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          range: (
            from: number,
            to: number,
          ) => Promise<{
            data: SnapshotRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

/**
 * Page through published_snapshots for one entity.
 * PostgREST caps a single response at max_rows (1000 in config.toml).
 * Keep requesting until a page is empty so a lowered max_rows cannot
 * silently truncate when pageSize still asks for more than the server returns.
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
    if (rows.length === 0) break;
    out.push(...rows);
    // Advance by what we actually received so a server cap below pageSize
    // cannot skip rows between pages.
    from += rows.length;
  }
  return out;
}
