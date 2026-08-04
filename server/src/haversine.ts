import type Database from 'better-sqlite3';

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in kilometers between two WGS84 points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Round to one decimal place for stable storage / display. */
export function roundDistanceKm(km: number): number {
  return Math.round(km * 10) / 10;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export function distanceBetweenKm(from: LatLng, to: LatLng): number {
  return roundDistanceKm(haversineKm(from.lat, from.lng, to.lat, to.lng));
}

/** Look up destination coordinates for a visit id. */
export function visitDestinationCoords(
  db: Database.Database,
  visitId: number
): LatLng | null {
  const row = db
    .prepare(
      `SELECT dest.lat AS lat, dest.lng AS lng
       FROM visits
       JOIN locations dest ON dest.id = visits.location_id
       WHERE visits.id = ?`
    )
    .get(visitId) as LatLng | undefined;
  return row ?? null;
}
