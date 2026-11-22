import { DEVICE_TABLES } from "./migrations";
import { migrate } from "./migrate";
import { openNodeSqlite } from "./nodeSqlite";
import { getCompletion, insertCompletionIgnore } from "./repos";

test("migration 1 creates every device table", async () => {
  const db = openNodeSqlite();
  const version = await migrate(db);
  expect(version).toBe(1);
  const rows = await db.getAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const names = rows.map((row) => row.name).sort();
  expect(names).toEqual([...DEVICE_TABLES].sort());
  const again = await migrate(db);
  expect(again).toBe(1);
  await db.close();
});

test("a second completion for the same version keeps the first row", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  const key = {
    fragment_id: "33333333-3333-4333-8333-333333333333",
    revision_no: 1,
    time_window: "day",
    on_site: 1,
    trigger: "proximity",
    session_id: "session-1",
  };
  await insertCompletionIgnore(db, { ...key, completed_at: "2026-01-01T00:00:00Z" });
  await insertCompletionIgnore(db, { ...key, completed_at: "2026-06-01T00:00:00Z" });
  const row = await getCompletion(db, key.fragment_id, key.revision_no, key.time_window);
  expect(row?.completed_at).toBe("2026-01-01T00:00:00Z");
  await db.close();
});
