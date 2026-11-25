import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { dataLayer } from "../runtime/dataLayer";
import { LocationService } from "../location/LocationService";
import { AudioSessionController } from "../audio/session/AudioSessionController";
import { ExploringRuntime } from "./ExploringRuntime";
import "../location/locationTask";

type Ctx = { runtime: ExploringRuntime | null };

const ExploringContext = createContext<Ctx>({ runtime: null });

export function useExploringRuntime(): ExploringRuntime | null {
  return useContext(ExploringContext).runtime;
}

export function ExploringProvider(props: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<ExploringRuntime | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let alive = true;
    const location = new LocationService();
    const audioSession = new AudioSessionController();
    void dataLayer()
      .then(async ({ db }) => {
        const next = new ExploringRuntime({ db, location, audioSession });
        await next.start();
        if (alive) setRuntime(next);
      })
      .catch(() => {
        console.info("exploring runtime failed to start");
      });
    return () => {
      alive = false;
      runtime?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ExploringContext.Provider value={{ runtime }}>{props.children}</ExploringContext.Provider>
  );
}
