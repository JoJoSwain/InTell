declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export interface StatementSync {
    run(...params: (string | number | null | undefined)[]): unknown;
    all(...params: (string | number | null | undefined)[]): Record<string, string | number | null>[];
    get(
      ...params: (string | number | null | undefined)[]
    ): Record<string, string | number | null> | undefined;
  }
}
