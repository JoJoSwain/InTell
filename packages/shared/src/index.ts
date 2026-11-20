export { L10n, pickL10n } from "./schemas/l10n";
export {
  TelemetryEvent,
  EVENT_NAMES,
  type EventName,
} from "./schemas/events";

export type {
  AudioEngine,
  AudioRoute,
  BufferHandle,
  BusId,
  EngineDiagnostics,
  LoopGroupHandle,
  NowPlayingMeta,
  VoiceHandle,
} from "./audio/AudioEngine";

export {
  dbToGain,
  equalPowerCrossfade,
  gainToDb,
} from "./audio/gain";

export {
  AFTERGLOW_MS,
  BUS_DEFAULT_DB,
  computeDuckingGains,
  computeDuckingLevels,
  DUCK_AMOUNT_DB,
  DUCK_ATTACK_MS,
  DUCK_RELEASE_MS,
  DuckingPolicy,
  SPEAKER_SURROUNDINGS_EXTRA_DB,
} from "./audio/DuckingPolicy";

export {
  DECODE_CACHE_CAP_BYTES,
  DecodedBufferLruAccounting,
  estimateDecodedPcmBytes,
  estimateDecodedPcmBytesAtRate,
} from "./audio/decodeCache";

export { createSeededRng, hashSeed, type SeededRng } from "./audio/seededRng";

export {
  DEFAULT_ONESHOT_SHAS,
  ONESHOT_HORIZON_SEC,
  ONESHOT_MEAN_INTERVAL_SEC,
  OneShotWindowScheduler,
  type OneShotPlan,
} from "./audio/oneshotSchedule";
