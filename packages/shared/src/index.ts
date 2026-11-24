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
  EmbarkMode,
  EmbarkRequest,
  EmbarkResponse,
  EmbarkStep,
  EmbarkTransitLine,
} from "./schemas/embark";
export {
  GrovePack,
  GrovePackDevice,
  GrovePackFragment,
  PreviewManifest,
  RegionPack,
  RegionPackDevice,
  PackIndexEntry,
} from "./schemas/packs";
export { DeviceAudioSettings } from "./schemas/settings";
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
  distanceInsideMeters,
  distanceMeters,
  pointInPolygon,
  toMultiPolygon,
  type GeoJsonArea,
  type GeoJsonMultiPolygon,
  type GeoJsonPolygon,
  type LatLng,
} from "./geo/polygon";

export {
  FAR_PIECE_M,
  GROVE_BUFFER_M,
  farPieces,
  groveShape,
  type GroveShapeFragment,
} from "./geo/groveShape";

export {
  CROSS_LINK_TIP_M,
  crossGroveLinks,
  crossLinkTip,
  storyWebLinks,
  type CrossGroveFragment,
  type CrossGroveLink,
  type StoryWebFragment,
} from "./story/web";

export {
  completionSatisfiesContingency,
  contingencyRevisionNo,
  type ChangeKind,
  type RevisionChange,
  type RevisionForContingency,
} from "./story/contingency";

export {
  chronicleReplay,
  completedEpoch,
  heardOlderEpoch,
  isPlayableNow,
  isUnlocked,
  markerState,
  memberSatisfied,
  pickVersion,
  unlocksToWrite,
  type CompletionRow,
  type ExternalPrerequisite,
  type FragmentInput,
  type MarkerState,
  type PulseKind,
  type UnlockRow,
  type VersionRef,
} from "./story/unlock";

export {
  ACCESSIBLE_RADIUS_M,
  chooseTrigger,
  proximityCandidates,
  queueAfterTrigger,
  scanDecision,
  TWO_FIX_WINDOW_MS,
  type LocationFix,
  type QueuedFragment,
  type TriggerCandidate,
  type TriggerVia,
} from "./story/trigger";

export {
  computedPlayedMs,
  initialSessionState,
  LOCATION_HIGH_WITHIN_M,
  OUTSIDE_END_MS,
  parseSessionState,
  SESSION_MAX_MS,
  SESSION_STATE_VERSION,
  sessionStep,
  storyStateOf,
  type PlayingRef,
  type SessionEffect,
  type SessionEvent,
  type SessionFragmentMeta,
  type SessionState,
  type SessionWorld,
} from "./story/session";

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
  GROVE_MUSIC_EDGE_FADE_M,
  musicConditionMatches,
  selectMusicCue,
  selectMusicCueDeferred,
  stemGainDb,
  type MusicCueInput,
  type MusicStemInput,
  type MusicStoryState,
  type StoryState,
} from "./audio/music";

export {
  activeProfiles,
  eligibleLayers,
  landcoverClass,
  nextOneShot,
  pickBed,
  scaleGainDb,
  type ActiveProfile,
  type AmbienceLayerInput,
  type AmbienceProfileInput,
  type AmbienceZoneInput,
  type OneShotEvent,
  type OneShotState,
} from "./audio/ambience";

export * from "./audio/soundFeatures";
export {
  depthConditionLatched,
  insideTierBuffersLatched,
} from "./audio/depthBloom";
export { pickResolve } from "./audio/resolve";
export {
  initialThresholdMotifState,
  thresholdMotifStep,
  type ThresholdMotifState,
} from "./audio/thresholdMotif";
export { beaconMix, chooseBeacon } from "./audio/beacon";
export {
  accentAllowed,
  backSkipMs,
  resumePointMs,
  suggestBreathPoints,
} from "./audio/breath";
export {
  initialLockedTeaserState,
  localDayKey,
  lockedTeaserStep,
} from "./audio/lockedTeaser";
export {
  initialMixLevelState,
  mixLevelFor,
  shedLayers,
} from "./audio/mixHealth";
export { allocateVoices } from "./audio/voices";

export {
  HUSH_CUE_DELAY_MS,
  HUSH_CUE_GAIN_DB,
  HUSH_FADE_IN_MS,
  HUSH_FADE_OUT_MS,
  HUSH_HOLD_MAX_S,
  HUSH_HOLD_MIN_S,
  HUSH_TRIGGER_FADE_MS,
  hushStep,
  initialHushState,
  type HushPhase,
  type HushState,
  type HushStep,
} from "./audio/hush";

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
  crestFactorDb,
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
