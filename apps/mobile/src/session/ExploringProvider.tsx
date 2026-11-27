import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { dataLayer } from "../runtime/dataLayer";
import { LocationService } from "../location/LocationService";
import { RNAudioApiEngine } from "../audio/engine/RNAudioApiEngine";
import { ExploringRuntime } from "./ExploringRuntime";
import type { ExploringEngine } from "./enginePort";
import "../location/locationTask";

type Ctx = { runtime: ExploringRuntime | null };

const ExploringContext = createContext<Ctx>({ runtime: null });

export function useExploringRuntime(): ExploringRuntime | null {
  return useContext(ExploringContext).runtime;
}

export function ExploringProvider(props: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<ExploringRuntime | null>(null);
  const started = useRef(false);
  const runtimeRef = useRef<ExploringRuntime | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let alive = true;
    const location = new LocationService();
    const engine = new RNAudioApiEngine() as unknown as ExploringEngine;
    void dataLayer()
      .then(async ({ db }) => {
        // B1: one RNAudioApiEngine — its internal AudioSessionController is the session.
        const next = new ExploringRuntime({ db, location, engine });
        await next.start();
        if (!alive) {
          next.dispose();
          return;
        }
        runtimeRef.current = next;
        setRuntime(next);
      })
      .catch(() => {
        console.info("exploring runtime failed to start");
      });
    return () => {
      alive = false;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, []);

  return (
    <ExploringContext.Provider value={{ runtime }}>{props.children}</ExploringContext.Provider>
  );
}
