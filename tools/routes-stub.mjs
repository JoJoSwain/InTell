/**
 * Local Google Routes API stub for embark integration tests.
 * Listens on PORT (default 8791). Never commit real keys.
 */
import http from "node:http";

const PORT = Number(process.env.ROUTES_STUB_PORT || 8791);
/** Bind address. CI uses 0.0.0.0 so Docker can reach the host via the bridge. */
const HOST = process.env.ROUTES_STUB_HOST || "127.0.0.1";

const POLYLINE_WALK = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
const POLYLINE_BIKE = "a~l~Fjk~uOwHJy@P";
const POLYLINE_TRANSIT_WALK = "wxy~F|abc@";
const POLYLINE_TRANSIT_RIDE = "zzz~F|def@";

function walkRoutesBody() {
  return {
    routes: [
      {
        duration: "1200s",
        distanceMeters: 2400,
        polyline: { encodedPolyline: POLYLINE_WALK },
        warnings: [
          "Walking routes are in beta and may sometimes be missing clear sidewalks.",
        ],
      },
    ],
  };
}

function bikeRoutesBody() {
  return {
    routes: [
      {
        duration: "600s",
        distanceMeters: 2800,
        polyline: { encodedPolyline: POLYLINE_BIKE },
        warnings: [
          "Bicycling routes are in beta and may sometimes be missing clear paths.",
        ],
      },
    ],
  };
}

function transitRoutesBody() {
  return {
    routes: [
      {
        duration: "1800s",
        distanceMeters: 5000,
        polyline: { encodedPolyline: POLYLINE_TRANSIT_RIDE },
        warnings: [],
        legs: [
          {
            steps: [
              {
                travelMode: "WALK",
                distanceMeters: 200,
                staticDuration: "180s",
                polyline: { encodedPolyline: POLYLINE_TRANSIT_WALK },
              },
              {
                travelMode: "TRANSIT",
                distanceMeters: 4800,
                staticDuration: "1620s",
                polyline: { encodedPolyline: POLYLINE_TRANSIT_RIDE },
                transitDetails: {
                  stopDetails: {
                    departureStop: { name: "Farmington Station" },
                    arrivalStop: { name: "Refuge Gate" },
                    departureTime: "2026-11-23T18:00:00Z",
                    arrivalTime: "2026-11-23T18:27:00Z",
                  },
                  stopCount: 4,
                  transitLine: {
                    name: "FrontRunner",
                    nameShort: "FR",
                    color: "#0055A5",
                    textColor: "#FFFFFF",
                    vehicle: { type: "COMMUTER_TRAIN" },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

/** @type {unknown} */
let lastRequest = null;

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "GET" && req.url === "/last") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(lastRequest ?? null));
    return;
  }

  if (req.method === "POST" && req.url?.includes("/directions/v2:computeRoutes")) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      body = {};
    }
    lastRequest = {
      travelMode: body.travelMode,
      languageCode: body.languageCode,
      fieldMask: req.headers["x-goog-fieldmask"] ?? null,
    };

    let payload;
    if (body.travelMode === "BICYCLE") payload = bikeRoutesBody();
    else if (body.travelMode === "TRANSIT") payload = transitRoutesBody();
    else payload = walkRoutesBody();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`routes-stub listening on http://${HOST}:${PORT}`);
});
