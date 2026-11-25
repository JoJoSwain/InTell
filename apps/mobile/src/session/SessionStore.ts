/**
 * Zustand exploring session UI + machine state (TECH_SPEC §3.1).
 */
import { create } from "zustand";
import {
  initialSessionState,
  type SessionState,
  type StoryState,
} from "@intell/shared";
import type { AfterglowUi, PlayRequest, TeaserUi } from "./applySessionEffects";

export type OverlayModel = {
  title: string;
  tier: "root" | "branch" | "leaf";
  progress: number;
  paused: boolean;
  fragmentId: string;
  /** Focus-denied hint (M6 F2); shown while paused. */
  busyHint?: string;
} | null;

type SessionStoreState = {
  session: SessionState;
  story: StoryState | null;
  overlay: OverlayModel;
  teaser: TeaserUi | null;
  afterglow: AfterglowUi | null;
  unlockBanner: boolean;
  playRequest: PlayRequest | null;
  locationMode: "idle" | "foreground" | "balanced" | "high";
  analyticsCount: number;
  setSession: (session: SessionState, story: StoryState | null) => void;
  setOverlay: (overlay: OverlayModel) => void;
  setTeaser: (teaser: TeaserUi | null) => void;
  setAfterglow: (afterglow: AfterglowUi | null) => void;
  setUnlockBanner: (show: boolean) => void;
  setPlayRequest: (play: PlayRequest | null) => void;
  setLocationMode: (mode: SessionStoreState["locationMode"]) => void;
  bumpAnalytics: () => void;
  resetUi: () => void;
};

export const useSessionStore = create<SessionStoreState>((set) => ({
  session: initialSessionState(),
  story: null,
  overlay: null,
  teaser: null,
  afterglow: null,
  unlockBanner: false,
  playRequest: null,
  locationMode: "idle",
  analyticsCount: 0,
  setSession: (session, story) => set({ session, story }),
  setOverlay: (overlay) => set({ overlay }),
  setTeaser: (teaser) => set({ teaser }),
  setAfterglow: (afterglow) => set({ afterglow }),
  setUnlockBanner: (unlockBanner) => set({ unlockBanner }),
  setPlayRequest: (playRequest) => set({ playRequest }),
  setLocationMode: (locationMode) => set({ locationMode }),
  bumpAnalytics: () => set((s) => ({ analyticsCount: s.analyticsCount + 1 })),
  resetUi: () =>
    set({
      overlay: null,
      teaser: null,
      afterglow: null,
      unlockBanner: false,
      playRequest: null,
    }),
}));
