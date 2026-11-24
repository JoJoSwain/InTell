/** Recorded Google Routes-shaped bodies for the stub and unit tests. */

export const POLYLINE_WALK = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
export const POLYLINE_BIKE = "a~l~Fjk~uOwHJy@P";
export const POLYLINE_TRANSIT_WALK = "wxy~F|abc@";
export const POLYLINE_TRANSIT_RIDE = "zzz~F|def@";

export const ORIGIN = { lat: 40.97, lng: -111.93 };
export const OPENING = { lat: 40.9612169, lng: -111.92895673 };
export const FAR_ORIGIN = { lat: 42.5, lng: -110.0 }; // > 150 km from OPENING
export const GROVE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";

export function walkRoutesBody() {
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

export function bikeRoutesBody() {
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

export function transitRoutesBody(opts?: { omitStopName?: boolean }) {
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
                    departureStop: opts?.omitStopName
                      ? {}
                      : { name: "Farmington Station" },
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
