import type { SqlDriver } from "./driver";
import { MIGRATIONS } from "./migrations";

export async function migrate(db: SqlDriver): Promise<number> {
  const current = await userVersion(db);
  let version = current;
  for (let index = current; index < MIGRATIONS.length; index += 1) {
    const statements = MIGRATIONS[index];
    if (!statements) continue;
    const next = index + 1;
    await db.withTransaction(async () => {
      for (const statement of statements) {
        await db.exec(statement);
      }
      await db.exec(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
  return version;
}

async function userVersion(db: SqlDriver): Promise<number> {
  const row = await db.getFirst<{ user_version: number }>("PRAGMA user_version");
  return row?.user_version ?? 0;
}
