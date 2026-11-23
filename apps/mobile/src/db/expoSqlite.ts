import * as SQLite from "expo-sqlite";
import type { SqlDriver, SqlParams } from "./driver";

/**
 * Opens `intell.db` inside `directory`.
 * WAL and shared-memory files are created beside that file (N3), so they stay
 * in the backed-up progress directory rather than a cache folder.
 */
export async function openExpoSqlite(directory: string): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync("intell.db", undefined, directory);
  await db.execAsync("PRAGMA journal_mode=WAL");
  return {
    async exec(sql) {
      await db.execAsync(sql);
    },
    async run(sql, params) {
      await db.runAsync(sql, bind(params));
    },
    async getAll(sql, params) {
      return db.getAllAsync(sql, bind(params));
    },
    async getFirst(sql, params) {
      return db.getFirstAsync(sql, bind(params));
    },
    async withTransaction(fn) {
      let result: unknown;
      await db.withTransactionAsync(async () => {
        result = await fn();
      });
      return result as Awaited<ReturnType<typeof fn>>;
    },
    async close() {
      await db.closeAsync();
    },
  };
}

function bind(params: SqlParams | undefined): (string | number | null)[] {
  return params ? [...params] : [];
}
