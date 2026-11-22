import { DatabaseSync } from "node:sqlite";

/** N1: jest-expo must be able to open Node's built-in sqlite before repositories use it. */
test("node:sqlite opens an in-memory database under jest-expo", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("create table probe (id integer)");
  db.prepare("insert into probe (id) values (?)").run(1);
  const row = db.prepare("select id from probe").get() as { id: number } | undefined;
  expect(row?.id).toBe(1);
  db.close();
});
