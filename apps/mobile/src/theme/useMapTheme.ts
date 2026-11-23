import { useEffect, useState } from "react";
import { AppState, useColorScheme } from "react-native";
import { getKv, setKv } from "../db/repos";
import { dataLayer } from "../runtime/dataLayer";
import {
  APPEARANCE_KEY,
  parseAppearance,
  resolveMapTheme,
  type AppearancePreference,
} from "./appearance";

const listeners = new Set<() => void>();

export function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function saveAppearance(preference: AppearancePreference): Promise<void> {
  const { db } = await dataLayer();
  await setKv(db, APPEARANCE_KEY, preference);
  for (const listener of listeners) listener();
}

export function useMapTheme(input: {
  hasRegion: boolean;
  sunReference: { lat: number; lng: number } | null;
  timeZone: string | null;
}): "day" | "night" {
  const phoneScheme = useColorScheme();
  const [preference, setPreference] = useState<AppearancePreference>("story");
  const [at, setAt] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    const load = () => {
      void dataLayer()
        .then(({ db }) => getKv(db, APPEARANCE_KEY))
        .then((value) => {
          if (alive) setPreference(parseAppearance(value));
        })
        .catch(() => undefined);
    };
    load();
    const unsubscribe = subscribeAppearance(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const tick = () => setAt(new Date());
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    const id = setInterval(() => {
      if (AppState.currentState === "active") tick();
    }, 15_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);

  return resolveMapTheme({
    preference,
    phoneScheme,
    hasRegion: input.hasRegion,
    at,
    sunReference: input.sunReference,
    timeZone: input.timeZone,
  });
}
