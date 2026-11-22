import { Directory, File } from "expo-file-system";
import { joinPath, type FileStore } from "./store";

function asUri(path: string): string {
  if (path.startsWith("file:") || path.startsWith("content:")) return path;
  return `file://${path}`;
}

export function diskFileStore(): FileStore {
  return {
    async read(uri) {
      const file = new File(asUri(uri));
      if (!file.exists) return null;
      return new Uint8Array(await file.arrayBuffer());
    },
    async write(uri, bytes) {
      const file = new File(asUri(uri));
      const parent = new Directory(parentUri(asUri(uri)));
      if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
      file.create();
      file.write(bytes);
    },
    async move(from, to) {
      const source = new File(asUri(from));
      const parent = new Directory(parentUri(asUri(to)));
      if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
      source.move(new File(asUri(to)));
    },
    async exists(uri) {
      return new File(asUri(uri)).exists;
    },
    async delete(uri) {
      const file = new File(asUri(uri));
      if (file.exists) file.delete();
    },
    async list(prefix) {
      const directory = new Directory(asUri(prefix));
      if (!directory.exists) return [];
      return directory.list().map((entry) => joinPath(prefix, entry.name));
    },
  };
}

function parentUri(uri: string): string {
  const index = uri.lastIndexOf("/");
  return index >= 0 ? uri.slice(0, index) : uri;
}
