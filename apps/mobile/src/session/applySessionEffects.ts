/**
 * Carry out every SessionEffect (M6). Coordinates never land in analytics or logs.
 */
import type { SessionEffect } from "@intell/shared";
import type { SqlDriver } from "../db/driver";
import {
  insertCompletionIgnore,
  upsertMetCharacter,
  upsertProgress,
  upsertUnlock,
  upsertVisit,
} from "../db/repos";

export type TeaserUi = {
  fragmentId: string;
  reason: "locked" | "wrongTime";
  teaserText: string;
  changeTeaser?: string;
  otherTimeHint?: string;
};

export type AfterglowUi = {
  endsAt: number;
  fragmentId: string;
  tier: "root" | "branch" | "leaf";
  unlockBanner: boolean;
};

export type LocationMode = "idle" | "foreground" | "balanced" | "high";

export type PlayRequest = {
  fragmentId: string;
  revisionNo: number;
  version: { lang: string; timeWindow: "day" | "night" };
  via: "proximity" | "accessible" | "scan";
  changeTeaser?: string;
};

export type EffectSinks = {
  db: SqlDriver;
  nowIso: () => string;
  setLocationMode: (mode: LocationMode) => void | Promise<void>;
  onPlay: (play: PlayRequest) => void | Promise<void>;
  onStopNarration: () => void | Promise<void>;
  onTeaser: (teaser: TeaserUi | null) => void;
  onAfterglow: (afterglow: AfterglowUi | null) => void;
  onUnlockBanner: () => void;
  /** Resolve authored teaser / hint text for a fragment (no title for locked). */
  resolveTeaserCopy: (
    fragmentId: string,
    reason: "locked" | "wrongTime",
  ) => { teaserText: string; otherTimeHint?: string };
  /** A7 / R4: count by name; ids stay in effect.refs (never coordinates). */
  onAnalytics: (name: string) => void;
};

export type ApplyResult = {
  analyticsCounted: number;
  growthMomentsIgnored: number;
};

export async function applySessionEffects(
  effects: readonly SessionEffect[],
  sinks: EffectSinks,
): Promise<ApplyResult> {
  let analyticsCounted = 0;
  let growthMomentsIgnored = 0;

  for (const effect of effects) {
    switch (effect.type) {
      case "sessionStarted":
        sinks.onAnalytics(effect.type);
        analyticsCounted += 1;
        break;
      case "sessionEnded":
        sinks.onAnalytics(effect.type);
        analyticsCounted += 1;
        sinks.onAfterglow(null);
        sinks.onTeaser(null);
        break;
      case "groveEntered":
        sinks.onAnalytics("grove_entered");
        analyticsCounted += 1;
        break;
      case "setLocationMode":
        await sinks.setLocationMode(effect.mode);
        break;
      case "play":
        await sinks.onPlay({
          fragmentId: effect.fragmentId,
          revisionNo: effect.revisionNo,
          version: effect.version,
          via: effect.via,
          changeTeaser: effect.changeTeaser,
        });
        break;
      case "stopNarration":
        await sinks.onStopNarration();
        break;
      case "showTeaser": {
        const copy = sinks.resolveTeaserCopy(effect.fragmentId, effect.reason);
        sinks.onTeaser({
          fragmentId: effect.fragmentId,
          reason: effect.reason,
          teaserText: copy.teaserText,
          changeTeaser: effect.changeTeaser,
          otherTimeHint: copy.otherTimeHint,
        });
        break;
      }
      case "recordCompletion":
        await insertCompletionIgnore(sinks.db, {
          fragment_id: effect.fragmentId,
          revision_no: effect.revisionNo,
          time_window: effect.timeWindow,
          completed_at: sinks.nowIso(),
          on_site: 1,
          trigger: effect.trigger,
          session_id: effect.sessionId,
        });
        break;
      case "recordProgress":
        await upsertProgress(sinks.db, {
          fragment_id: effect.fragmentId,
          revision_no: effect.revisionNo,
          time_window: effect.timeWindow,
          max_progress_ms: effect.maxProgressMs,
          updated_at: sinks.nowIso(),
        });
        break;
      case "writeUnlocks":
        for (const fragmentId of effect.fragmentIds) {
          await upsertUnlock(sinks.db, fragmentId, sinks.nowIso());
        }
        if (effect.fragmentIds.length > 0) sinks.onUnlockBanner();
        break;
      case "metCharacters":
        for (const characterId of effect.characterIds) {
          await upsertMetCharacter(sinks.db, {
            character_id: characterId,
            met_at: sinks.nowIso(),
            fragment_id: effect.fragmentId,
          });
        }
        break;
      case "writeVisit":
        for (const grove of effect.groves) {
          await upsertVisit(sinks.db, {
            session_id: effect.sessionId,
            grove_id: grove.groveId,
            started_at: new Date(effect.startedAt).toISOString(),
            ended_at: new Date(effect.endedAt).toISOString(),
            fragments_completed: grove.fragmentsCompleted,
            time_window: effect.timeWindow,
          });
        }
        break;
      case "startAfterglow":
        sinks.onAfterglow({
          endsAt: effect.endsAt,
          fragmentId: effect.fragmentId,
          tier: effect.tier,
          unlockBanner: false,
        });
        break;
      case "analytics":
        // A7 shape is { name, props, refs }; mobile counts by name only for now.
        sinks.onAnalytics(effect.name);
        analyticsCounted += 1;
        break;
      case "growthMoment":
        growthMomentsIgnored += 1;
        break;
      default: {
        const _exhaustive: never = effect;
        void _exhaustive;
      }
    }
  }

  return { analyticsCounted, growthMomentsIgnored };
}
