import {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  type ConfigPlugin,
} from "expo/config-plugins";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Local walk / USB test builds only.
 *
 * When `EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT=1`, allow cleartext HTTP to
 * localhost / 127.0.0.1 so `adb reverse tcp:54321` can reach the PC's
 * Supabase. Never enable for store builds (flag must be unset).
 */
const withLocalCleartext: ConfigPlugin = (config) => {
  const enabled =
    process.env.EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT === "1" ||
    process.env.EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT === "true";

  if (!enabled) return config;

  config = withDangerousMod(config, [
    "android",
    async (mod) => {
      const resXml = join(
        mod.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      mkdirSync(resXml, { recursive: true });
      writeFileSync(
        join(resXml, "network_security_config.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<!-- LOCAL TEST ONLY — generated when EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT=1.
     Cleartext to loopback for adb reverse → local Supabase. -->
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">127.0.0.1</domain>
  </domain-config>
</network-security-config>
`,
      );
      return mod;
    },
  ]);

  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      mod.modResults,
    );
    application.$["android:networkSecurityConfig"] =
      "@xml/network_security_config";
    // Do not set android:usesCleartextTraffic — keep it domain-scoped.
    return mod;
  });
};

export default withLocalCleartext;
