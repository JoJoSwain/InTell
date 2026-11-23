export interface FileStore {
  read(uri: string): Promise<Uint8Array | null>;
  write(uri: string, bytes: Uint8Array): Promise<void>;
  move(from: string, to: string): Promise<void>;
  exists(uri: string): Promise<boolean>;
  delete(uri: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export function joinPath(directory: string, name: string): string {
  return `${directory.replace(/\/+$/, "")}/${name}`;
}

export function memoryFileStore(): FileStore {
  const files = new Map<string, Uint8Array>();
  return {
    async read(uri) {
      const bytes = files.get(uri);
      return bytes ? new Uint8Array(bytes) : null;
    },
    async write(uri, bytes) {
      files.set(uri, new Uint8Array(bytes));
    },
    async move(from, to) {
      const bytes = files.get(from);
      if (!bytes) throw new Error("staged file missing");
      files.set(to, bytes);
      files.delete(from);
    },
    async exists(uri) {
      return files.has(uri);
    },
    async delete(uri) {
      files.delete(uri);
    },
    async list(prefix) {
      return [...files.keys()].filter((key) => key.startsWith(prefix));
    },
  };
}
