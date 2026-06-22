const EARTH_RADIUS_METERS = 6371000; /** According to what they said sha
 * 
 * @param lat1 
 * @param lng1 
 * @param lat2 
 * @param lng2 
 * @returns 
 */

/**
 * Great-circle distance between two lat/lng points, in meters.
 * Uses the haversine formula.
 */
export function distanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}