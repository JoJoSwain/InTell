/**
 * M2a (B8): generate apps/mobile/e2e/demo-route.gpx from Demo Park constants.
 * Passes every marked/unmarked fragment (not protected) and crosses zone edges.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Must stay in sync with supabase/seed.sql Demo Park constants.
const CENTER = { lon: -111.9, lat: 40.9 };
const HALF = 0.0015;
const pts = {
  root: { lon: CENTER.lon, lat: CENTER.lat },
  branchA: { lon: CENTER.lon - 0.0004, lat: CENTER.lat + 0.0004 },
  branchB: { lon: CENTER.lon + 0.0004, lat: CENTER.lat + 0.00035 }, // unmarked
  leafA: { lon: CENTER.lon - 0.0006, lat: CENTER.lat - 0.0003 },
  // leafB protected — intentionally omitted from route
  leafC: { lon: CENTER.lon + 0.00055, lat: CENTER.lat - 0.00035 },
  // cross ambience + music zone edges (zones cover grove; dip just outside then back)
  outsideEdge: { lon: CENTER.lon + HALF + 0.0002, lat: CENTER.lat },
  insideAgain: { lon: CENTER.lon + 0.0002, lat: CENTER.lat - 0.0002 },
};

const track = [
  pts.root,
  pts.branchA,
  pts.leafA,
  pts.root,
  pts.branchB,
  pts.leafC,
  pts.outsideEdge,
  pts.insideAgain,
  pts.root,
];

const when = (i) => {
  const d = new Date(Date.UTC(2026, 0, 1, 18, 0, i * 30));
  return d.toISOString();
};

const trkpts = track
  .map(
    (p, i) =>
      `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>1300</ele><time>${when(i)}</time></trkpt>`,
  )
  .join("\n");

const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="InTell M2a demo-route-gpx" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Demo Park walk (placeholder coordinates)</name>
    <desc>TODO(JoJo): placeholder coordinates — passes marked/unmarked fragments; skips protected; crosses zone edges</desc>
  </metadata>
  <trk>
    <name>demo-route</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;

const out = path.resolve(__dirname, "../apps/mobile/e2e/demo-route.gpx");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, gpx);
console.log(`Wrote ${out}`);
