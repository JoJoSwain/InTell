import { insertCompletionIgnore, upsertPack } from "../db/repos";
import { dataLayer } from "../runtime/dataLayer";
import { buildDemo, buildStress } from "./fixtures";

export async function installDemoGrove(): Promise<void> {
  const { db } = await dataLayer();
  const demo = buildDemo();
  const now = new Date().toISOString();
  await upsertPack(db, {
    scope: "grove",
    id: demo.grove.groveId,
    version: demo.grove.packVersion,
    manifest_json: JSON.stringify(demo.grove),
    installed_at: now,
  });
  await upsertPack(db, {
    scope: "region",
    id: demo.region.regionId,
    version: demo.region.packVersion,
    manifest_json: JSON.stringify(demo.region),
    installed_at: now,
  });
  for (const row of demo.completions) {
    await insertCompletionIgnore(db, row);
  }
}

export async function installStressGrove(): Promise<void> {
  const { db } = await dataLayer();
  const stress = buildStress();
  const now = new Date().toISOString();
  await upsertPack(db, {
    scope: "grove",
    id: stress.grove.groveId,
    version: stress.grove.packVersion,
    manifest_json: JSON.stringify(stress.grove),
    installed_at: now,
  });
  await upsertPack(db, {
    scope: "region",
    id: stress.region.regionId,
    version: stress.region.packVersion,
    manifest_json: JSON.stringify(stress.region),
    installed_at: now,
  });
}
