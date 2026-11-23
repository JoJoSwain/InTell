import { describe, expect, it } from "vitest";
import { pagePublishedSnapshots } from "../../../supabase/functions/_shared/pageSnapshots.ts";

type FakeRow = {
  entity: string;
  entity_id: string;
  data: unknown;
  published_at: string;
};

function fakeClient(rows: FakeRow[]) {
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
          return Promise.resolve({
            data: filtered.slice(from, to + 1),
            error: null,
          });
        },
      };
      return api;
    },
  };
}

describe("pagePublishedSnapshots", () => {
  it("walks past a lowered page size without dropping rows", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      entity: "fragment",
      entity_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      data: { id: i },
      published_at: "2026-01-01T00:00:00Z",
    }));
    const got = await pagePublishedSnapshots(fakeClient(rows), "fragment", {
      pageSize: 2,
    });
    expect(got).toHaveLength(5);
    expect(got.map((row) => row.entity_id)).toEqual(
      rows.map((row) => row.entity_id),
    );
  });
});
