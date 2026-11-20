/**
 * Display units are feet and miles; storage is metres (ADR 0004 §12, PRODUCT_SPEC).
 * Both `-meters` and `-metres` spellings are exported.
 */

export const METERS_PER_FOOT = 0.3048;
export const METRES_PER_FOOT = METERS_PER_FOOT;
export const FEET_PER_METER = 1 / METERS_PER_FOOT;
export const FEET_PER_METRE = FEET_PER_METER;
export const METERS_PER_MILE = 1609.344;
export const METRES_PER_MILE = METERS_PER_MILE;
export const MILES_PER_METER = 1 / METERS_PER_MILE;
export const MILES_PER_METRE = MILES_PER_METER;

/** Trigger radius bounds (DATA_MODEL §4): 15–35 ft stored as metres. */
export const MIN_TRIGGER_RADIUS_FT = 15;
export const MAX_TRIGGER_RADIUS_FT = 35;
export const DEFAULT_TRIGGER_RADIUS_FT = 35;
export const MIN_TRIGGER_RADIUS_M = 4.57;
export const MAX_TRIGGER_RADIUS_M = 10.67;
export const DEFAULT_TRIGGER_RADIUS_M = 10.67;

export function metersToFeet(meters: number): number {
  return meters * FEET_PER_METER;
}
export const metresToFeet = metersToFeet;

export function feetToMeters(feet: number): number {
  return feet * METERS_PER_FOOT;
}
export const feetToMetres = feetToMeters;

export function metersToMiles(meters: number): number {
  return meters * MILES_PER_METER;
}
export const metresToMiles = metersToMiles;

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}
export const milesToMetres = milesToMeters;

/** Round trigger radius for display (nearest foot). */
export function formatFeet(meters: number): string {
  return `${Math.round(metersToFeet(meters))} ft`;
}
