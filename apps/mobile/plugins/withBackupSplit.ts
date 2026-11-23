import { AndroidConfig, withAndroidManifest, withDangerousMod, type ConfigPlugin } from "expo/config-plugins";
import fs from "fs";
import path from "path";

export const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="sharedpref" path="SecureStore"/>
    <exclude domain="file" path="intell-assets"/>
    <exclude domain="file" path="intell-preview"/>
    <exclude domain="file" path="intell-staging"/>
  </cloud-backup>
  <device-transfer>
    <exclude domain="sharedpref" path="SecureStore"/>
    <exclude domain="file" path="intell-assets"/>
    <exclude domain="file" path="intell-preview"/>
    <exclude domain="file" path="intell-staging"/>
  </device-transfer>
</data-extraction-rules>
`;

export const FULL_BACKUP_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="sharedpref" path="SecureStore"/>
  <exclude domain="file" path="intell-assets"/>
  <exclude domain="file" path="intell-preview"/>
  <exclude domain="file" path="intell-staging"/>
</full-backup-content>
`;

const withBackupRules: ConfigPlugin = (config) => {
  config = withDangerousMod(config, [
    "android",
    (mod) => {
      const xmlDir = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "res", "xml");
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, "intell_data_extraction_rules.xml"), DATA_EXTRACTION_RULES);
      fs.writeFileSync(path.join(xmlDir, "intell_full_backup_content.xml"), FULL_BACKUP_CONTENT);
      return mod;
    },
  ]);
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    application.$["android:dataExtractionRules"] = "@xml/intell_data_extraction_rules";
    application.$["android:fullBackupContent"] = "@xml/intell_full_backup_content";
    return mod;
  });
};

export default withBackupRules;
