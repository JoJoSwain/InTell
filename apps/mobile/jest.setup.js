jest.mock("audio-session", () => ({
  __esModule: true,
  default: {
    start: jest.fn(async () => undefined),
    update: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    requestFocus: jest.fn(async () => true),
    abandonFocus: jest.fn(async () => undefined),
    logContextState: jest.fn(async () => undefined),
    logBreadcrumb: jest.fn(async () => undefined),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
  unregisterTaskAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, Highest: 1, High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    granted: true,
    canAskAgain: true,
  })),
  getForegroundPermissionsAsync: jest.fn(async () => ({
    granted: true,
    canAskAgain: true,
  })),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  startLocationUpdatesAsync: jest.fn(async () => undefined),
  stopLocationUpdatesAsync: jest.fn(async () => undefined),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 0, longitude: 0, accuracy: 10 },
    timestamp: Date.now(),
  })),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(async (_alg, value) => {
    const { createHash } = require("node:crypto");
    return createHash("sha256").update(String(value), "utf8").digest("hex");
  }),
  randomUUID: jest.fn(() => "00000000-0000-4000-8000-000000000099"),
}));

jest.mock("zustand", () => {
  const actual = jest.requireActual("zustand");
  return actual;
});
