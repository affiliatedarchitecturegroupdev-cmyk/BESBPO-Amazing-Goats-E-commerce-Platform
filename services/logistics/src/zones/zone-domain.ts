import { DeliveryQuote, GeoPoint, Zone } from './zones.types';

/** Ray casting: a point is inside a polygon if a ray crosses its edges an odd number of times. */
export function pointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const straddles = a.lat > point.lat !== b.lat > point.lat;
    const x = ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (straddles && point.lng < x) inside = !inside;
  }
  return inside;
}

/** The first zone whose polygon contains the point. */
export function findZone(point: GeoPoint, zones: Zone[]): Zone | undefined {
  return zones.find((zone) => zone.polygon && zone.polygon.length >= 3 && pointInPolygon(point, zone.polygon));
}

/**
 * Zone check at checkout: is the address deliverable, and what does delivery cost?
 * Delivery is free once the goods total reaches the zone's free-over threshold.
 */
export function quoteDelivery(point: GeoPoint, zones: Zone[], goodsTotalCents = 0): DeliveryQuote {
  const zone = findZone(point, zones);
  if (!zone) return { deliverable: false };
  const feeCents = zone.freeOverCents !== undefined && goodsTotalCents >= zone.freeOverCents ? 0 : zone.feeCents;
  return { deliverable: true, zone, feeCents };
}
