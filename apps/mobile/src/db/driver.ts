export type SqlValue = string | number | null;

export type SqlParams = readonly SqlValue[];

export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParams): Promise<void>;
  getAll<T extends Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]>;
  getFirst<T extends Record<string, SqlValue>>(
    sql: string,
    params?: SqlParams,
  ): Promise<T | null>;
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
