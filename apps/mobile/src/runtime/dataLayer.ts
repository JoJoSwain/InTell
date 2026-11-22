import { PackIndexEntry } from "@intell/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import * as Application from "expo-application";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import IntellStorage from "intell-storage";
import { installPack } from "../packs/install";
import { transportFromNetworkType, type Transport } from "../packs/policy";
import { syncContent } from "../packs/sync";
import { clearPreview, storePreview } from "../preview/session";
import { openExpoSqlite } from "../db/expoSqlite";
import { migrate } from "../db/migrate";
import type { SqlDriver } from "../db/driver";
import { listAssets, listPacks, listPreview } from "../db/repos";
import { diskFileStore } from "../files/disk";
import { reconcile } from "../files/reconcile";
import { expoDigester } from "../files/sha";
import type { FileStore } from "../files/store";
import { getOrCreateDeviceId, logDevice, type SecretStore } from "../identity/deviceId";
import { httpRegistrar, noopRegistrar, startRegistration } from "../identity/register";
import { ensureStorageLayout } from "../storage/layout";

type Extra = { supabaseUrl?: string; supabasePublishableKey?: string };

export type DataCounts = { packs: number; assets: number; preview: number };

type Layer = {
  db: SqlDriver;
  files: FileStore;
  assetDirectory: string;
  previewDirectory: string;
  stagingDirectory: string;
  deviceId: string;
  client: SupabaseClient | null;
  reexcludePreview: () => void;
};

const secrets: SecretStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
};

const memoryAuth = new Map<string, string>();

let layerPromise: Promise<Layer> | null = null;
let listening = false;

export function supabaseConfig(): { url: string; key: string } | null {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  const url = extra?.supabaseUrl?.trim() ?? "";
  const key = extra?.supabasePublishableKey?.trim() ?? "";
  if (!url || !key) return null;
  return { url, key };
}

export function dataLayer(): Promise<Layer> {
  layerPromise ??= boot();
  return layerPromise;
}

async function boot(): Promise<Layer> {
  const layout = ensureStorageLayout(IntellStorage);
  const db = await openExpoSqlite(layout.progressDirectory);
  await migrate(db);
  const files = diskFileStore();
  await reconcile({
    db,
    files,
    assetDirectory: layout.assetDirectory,
    previewDirectory: layout.previewDirectory,
  });
  const deviceId = await getOrCreateDeviceId(secrets, randomUUID);
  logDevice(deviceId, (line) => {
    console.info(line);
  });
  const config = supabaseConfig();
  const client = config
    ? createClient(config.url, config.key, {
        auth: {
          storage: {
            getItem: (key) => Promise.resolve(memoryAuth.get(key) ?? null),
            setItem: (key, value) => {
              memoryAuth.set(key, value);
              return Promise.resolve();
            },
            removeItem: (key) => {
              memoryAuth.delete(key);
              return Promise.resolve();
            },
          },
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
  const layer: Layer = {
    db,
    files,
    assetDirectory: layout.assetDirectory,
    previewDirectory: layout.previewDirectory,
    stagingDirectory: layout.stagingDirectory,
    deviceId,
    client,
    reexcludePreview: () => {
      IntellStorage.ensureExcludedDirectory("intell-preview");
    },
  };
  startListeners(layer);
  const version = (Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "0.0.0").slice(0, 32);
  const language = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase().startsWith("es") ? "es" : "en";
  startRegistration({
    db,
    registrar: config
      ? httpRegistrar({
          supabaseUrl: config.url,
          publishableKey: config.key,
          log: (line) => {
            console.info(line);
          },
        })
      : noopRegistrar,
    input: {
      deviceId,
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: version,
      uiLanguage: language,
    },
  });
  return layer;
}

function startListeners(layer: Layer): void {
  if (listening) return;
  listening = true;
  let online = false;
  AppState.addEventListener("change", (state) => {
    if (state === "active") void syncWithTransport(layer, "wifi-probe");
  });
  void Network.getNetworkStateAsync().then((state) => {
    online = state.isConnected === true;
  });
  Network.addNetworkStateListener((state) => {
    const connected = state.isConnected === true;
    if (connected && !online) void syncWithTransport(layer, transportFromNetworkType(state.type));
    online = connected;
  });
}

async function syncWithTransport(layer: Layer, transport: Transport | "wifi-probe"): Promise<void> {
  if (!layer.client) return;
  const resolved =
    transport === "wifi-probe"
      ? transportFromNetworkType((await Network.getNetworkStateAsync()).type)
      : transport;
  await runSync(layer, resolved, async () => false);
}

export async function counts(): Promise<DataCounts> {
  const layer = await dataLayer();
  return {
    packs: (await listPacks(layer.db)).length,
    assets: (await listAssets(layer.db)).length,
    preview: (await listPreview(layer.db)).length,
  };
}

export async function installGrove(groveId: string): Promise<void> {
  const layer = await dataLayer();
  const config = supabaseConfig();
  if (!layer.client || !config) throw new Error("Supabase URL and publishable key are not set");
  const { data, error } = await layer.client.rpc("get_pack_index");
  if (error) throw new Error("pack index failed");
  const index = PackIndexEntry.array().parse(data);
  const grove = index.find((entry) => entry.scope === "grove" && entry.id === groveId);
  if (!grove) throw new Error("grove is not in the pack index");
  await installPack({
    entry: grove,
    supabaseUrl: config.url,
    http: httpGet,
    files: layer.files,
    db: layer.db,
    digest: expoDigester,
    assetDirectory: layer.assetDirectory,
    stagingDirectory: layer.stagingDirectory,
  });
  await runSync(layer, "wifi", async () => false);
}

export async function syncNow(transport: Transport, confirmCellular: () => Promise<boolean>): Promise<void> {
  const layer = await dataLayer();
  if (!layer.client) throw new Error("Supabase URL and publishable key are not set");
  await runSync(layer, transport, confirmCellular);
}

async function runSync(
  layer: Layer,
  transport: Transport,
  confirmCellular: () => Promise<boolean>,
): Promise<void> {
  const client = layer.client;
  const config = supabaseConfig();
  if (!client || !config) throw new Error("Supabase URL and publishable key are not set");
  await syncContent({
    transport,
    confirmCellular,
    db: layer.db,
    files: layer.files,
    fetchIndex: async () => {
      const { data, error } = await client.rpc("get_pack_index");
      if (error) throw new Error("pack index failed");
      return PackIndexEntry.array().parse(data);
    },
    install: async (entry) => {
      await installPack({
        entry,
        supabaseUrl: config.url,
        http: httpGet,
        files: layer.files,
        db: layer.db,
        digest: expoDigester,
        assetDirectory: layer.assetDirectory,
        stagingDirectory: layer.stagingDirectory,
      });
    },
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  const layer = await dataLayer();
  if (!layer.client) throw new Error("Supabase URL and publishable key are not set");
  const { error } = await layer.client.auth.signInWithPassword({ email, password });
  if (error) throw new Error("sign-in failed");
}

export async function fetchPreview(releaseId: string): Promise<void> {
  const layer = await dataLayer();
  if (!layer.client) throw new Error("Supabase URL and publishable key are not set");
  const { data } = await layer.client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("sign in first");
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase URL and publishable key are not set");
  const response = await fetch(`${config.url.replace(/\/+$/, "")}/functions/v1/preview`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ releaseId }),
  });
  const body: unknown = await response.json().catch(() => ({}));
  await storePreview({
    response: { status: response.status, body },
    db: layer.db,
    files: layer.files,
    http: httpGet,
    digest: expoDigester,
    previewDirectory: layer.previewDirectory,
  });
}

export async function signOut(): Promise<void> {
  const layer = await dataLayer();
  await clearPreview({
    db: layer.db,
    files: layer.files,
    previewDirectory: layer.previewDirectory,
    signOut: async () => {
      await layer.client?.auth.signOut();
    },
    reexcludePreview: layer.reexcludePreview,
  });
}

async function httpGet(url: string): Promise<{ status: number; body: Uint8Array }> {
  const response = await fetch(url);
  const body = new Uint8Array(await response.arrayBuffer());
  return { status: response.status, body };
}
