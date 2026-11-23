import { describe, expect, it } from "vitest";
import { pagePublishedSnapshots } from "../../../supabase/functions/_shared/pageSnapshots.ts";

type FakeRow = {
  entity: string;
  entity_id: string;
  data: unknown;
  published_at: string;
};

function fakeClient(rows: FakeRow[], opts?: { maxRows?: number }) {
  const maxRows = opts?.maxRows;
  return {
    from(_table: string) {
      let filtered = rows.slice();
      const api = {
        select(_cols: string) {
          return api;
        },
        eq(col: string, value: string) {
          filtered = filtered.filter(
            (row) => (row as Record<string, unknown>)[col] === value,
          );
          return api;
        },
        order(_col: string, _opts: { ascending: boolean }) {
          return api;
        },
        range(from: number, to: number) {
          let page = filtered.slice(from, to + 1);
          if (maxRows !== undefined) page = page.slice(0, maxRows);
          return Promise.resolve({
            data: page,
            error: null,
          });
        },
      };
      return api;
    },
  };
}

function fragmentRows(n: number): FakeRow[] {
  return Array.from({ length: n }, (_, i) => ({
    entity: "fragment",
    entity_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    data: { id: i },
    published_at: "2026-01-01T00:00:00Z",
  }));
}

describe("pagePublishedSnapshots", () => {
  it("walks past a lowered page size without dropping rows", async () => {
    const rows = fragmentRows(5);
    const got = await pagePublishedSnapshots(fakeClient(rows), "fragment", {
      pageSize: 2,
    });
    expect(got).toHaveLength(5);
    expect(got.map((row) => row.entity_id)).toEqual(
      rows.map((row) => row.entity_id),
    );
  });

  it("keeps paging when the server returns fewer rows than requested", async () => {
    const rows = fragmentRows(7);
    // Client asks for 5; server caps at 2 (like a lowered PostgREST max_rows).
    const got = await pagePublishedSnapshots(
      fakeClient(rows, { maxRows: 2 }),
      "fragment",
      { pageSize: 5 },
    );
    expect(got).toHaveLength(7);
    expect(got.map((row) => row.entity_id)).toEqual(
      rows.map((row) => row.entity_id),
    );
  });
});
