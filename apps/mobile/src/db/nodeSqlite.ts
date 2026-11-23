import { DatabaseSync } from "node:sqlite";
import type { SqlDriver, SqlParams, SqlValue } from "./driver";

/** Test driver. Proven under jest-expo before the repositories were written (N1). */
export function openNodeSqlite(filename = ":memory:"): SqlDriver {
  const db = new DatabaseSync(filename);
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params) {
      db.prepare(sql).run(...bind(params));
    },
    async getAll<T extends Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]> {
      return db.prepare(sql).all(...bind(params)) as T[];
    },
    async getFirst<T extends Record<string, SqlValue>>(
      sql: string,
      params?: SqlParams,
    ): Promise<T | null> {
      const row = db.prepare(sql).get(...bind(params)) as T | undefined;
      return row ?? null;
    },
    async withTransaction(fn) {
      db.exec("begin");
      try {
        const result = await fn();
        db.exec("commit");
        return result;
      } catch (error) {
        db.exec("rollback");
        throw error;
      }
    },
    async close() {
      db.close();
    },
  };
}

function bind(params: SqlParams | undefined): (string | number | null)[] {
  return params ? [...params] : [];
}
