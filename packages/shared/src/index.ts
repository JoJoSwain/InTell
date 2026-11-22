export { isL10nBlank, L10n, pickL10n } from "./schemas/l10n";
export {
  TelemetryEvent,
  EVENT_NAMES,
  type EventName,
} from "./schemas/events";
export {
  MusicCondition,
  StemRule,
  StemRulePack,
} from "./schemas/music";
export {
  AgeGate,
  DevicePlatform,
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  UiLanguage,
} from "./schemas/device";
export {
  GrovePack,
  GrovePackFragment,
  PreviewManifest,
  RegionPack,
  PackIndexEntry,
} from "./schemas/packs";
export {
  assetsToDelete,
  assetsToFetch,
  manifestShas,
  type PackManifest,
} from "./packs/syncDiff";
export {
  AmbienceLayerSnapshot,
  AmbienceProfileSnapshot,
  AmbienceZoneSnapshot,
  CharacterSnapshot,
  FragmentSnapshot,
  GroveSnapshot,
  ImageSnapshot,
  MusicCueSnapshot,
  MusicCueStemSnapshot,
  MusicZoneSnapshot,
  SnapshotSchemas,
  UiCueSnapshot,
  parseSnapshot,
  safeParseSnapshot,
  type SnapshotData,
  type SnapshotEntity,
} from "./schemas/snapshots";
export {
  canonicalJson,
  contentSha256,
  roundCoord,
  roundCoordsDeep,
  sortKeysDeep,
} from "./canonicalJson";

export {
  completionSatisfiesContingency,
  contingencyRevisionNo,
  type ChangeKind,
  type RevisionChange,
  type RevisionForContingency,
} from "./story/contingency";

export {
  currentTimeWindow,
  localMinutesSinceMidnight,
  polarFallbackTimeWindow,
} from "./time/timeWindow";
export type {
  SunReference,
  TimeWindow,
  TimeWindow as DayNight,
} from "./time/timeWindow";

export {
  DEFAULT_TRIGGER_RADIUS_FT,
  DEFAULT_TRIGGER_RADIUS_M,
  FEET_PER_METER,
  FEET_PER_METRE,
  MAX_TRIGGER_RADIUS_FT,
  MAX_TRIGGER_RADIUS_M,
  METERS_PER_FOOT,
  METERS_PER_MILE,
  METRES_PER_MILE,
  MILES_PER_METER,
  MIN_TRIGGER_RADIUS_FT,
  MIN_TRIGGER_RADIUS_M,
  feetToMeters,
  feetToMetres,
  formatFeet,
  metersToFeet,
  metersToMiles,
  metresToFeet,
  metresToMiles,
  milesToMeters,
  milesToMetres,
} from "./units";

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

export {
  audioFormatOffTarget,
  BITRATE_TARGETS,
  LOUDNESS_TARGETS,
  loudnessOffTarget,
  measureLoudness,
  type AudioFormatParams,
  type LoudnessAssetKind,
  type LoudnessResult,
} from "./audio/loudness";

export {
  parseM4aAudioParams,
  type M4aAudioParams,
} from "./audio/container";
