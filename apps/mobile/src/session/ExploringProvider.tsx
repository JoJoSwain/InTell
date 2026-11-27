import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dataLayer } from "../runtime/dataLayer";
import { LocationService } from "../location/LocationService";
import { RNAudioApiEngine } from "../audio/engine/RNAudioApiEngine";
import {
  getExploringRuntime,
  type ExploringRuntime,
} from "./ExploringRuntime";
import type { ExploringEngine } from "./enginePort";
import "../location/locationTask";

type Ctx = { runtime: ExploringRuntime | null };

const ExploringContext = createContext<Ctx>({ runtime: null });

/** Process-wide: React remount must not create a second engine/runtime (A10). */
let processLocation: LocationService | null = null;
let processEngine: ExploringEngine | null = null;
let processStart: Promise<ExploringRuntime> | null = null;

async function ensureProcessRuntime(): Promise<ExploringRuntime> {
  if (!processStart) {
    processStart = (async () => {
      try {
        const { db } = await dataLayer();
        processLocation ??= new LocationService();
        processEngine ??= new RNAudioApiEngine() as unknown as ExploringEngine;
        const runtime = getExploringRuntime({
          db,
          location: processLocation,
          engine: processEngine,
        });
        // RNAudioApiEngine.init() is idempotent (returns if context exists).
        await runtime.start();
        return runtime;
      } catch (err) {
        // Next mount may retry — engine.init is safe to call again.
        processStart = null;
        throw err;
      }
    })();
  }
  return processStart;
}

export function useExploringRuntime(): ExploringRuntime | null {
  return useContext(ExploringContext).runtime;
}

export function ExploringProvider(props: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<ExploringRuntime | null>(null);

  useEffect(() => {
    let alive = true;
    void ensureProcessRuntime()
      .then((next) => {
        if (alive) setRuntime(next);
      })
      .catch(() => {
        console.info("exploring runtime failed to start");
      });
    // Never dispose on unmount — the runtime and engine are one per process.
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ExploringContext.Provider value={{ runtime }}>{props.children}</ExploringContext.Provider>
  );
}
