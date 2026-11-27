/**
 * F4: fail if introspected Expo config loses FOREGROUND_SERVICE_LOCATION
 * or the intell://f intent filter (stale native project / app.config drift).
 */
import appConfig from "../../app.config";

describe("android manifest contract (F4)", () => {
  const config = appConfig({
    config: {
      name: "InTell",
      slug: "intell",
      scheme: "intell",
      android: { package: "org.replaceplace.intell" },
      ios: { bundleIdentifier: "org.replaceplace.intell" },
      plugins: [],
    },
  } as never);

  it("includes FOREGROUND_SERVICE_LOCATION", () => {
    const perms = config.android?.permissions ?? [];
    expect(perms).toContain("android.permission.FOREGROUND_SERVICE_LOCATION");
  });

  it("includes intell://f intent filter", () => {
    const filters = config.android?.intentFilters ?? [];
    const intellF = filters.some((f) => {
      const raw = f.data;
      const data = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return data.some(
        (d) =>
          d.scheme === "intell" &&
          (d.host === "f" || (d.pathPrefix ?? "").startsWith("/")),
      );
    });
    expect(intellF).toBe(true);
  });

  it("includes https /f intent filter", () => {
    const filters = config.android?.intentFilters ?? [];
    const httpsF = filters.some((f) => {
      const raw = f.data;
      const data = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return data.some(
        (d) =>
          d.scheme === "https" &&
          (d.pathPrefix === "/f" || d.pathPrefix === "/f/"),
      );
    });
    expect(httpsF).toBe(true);
  });
});
