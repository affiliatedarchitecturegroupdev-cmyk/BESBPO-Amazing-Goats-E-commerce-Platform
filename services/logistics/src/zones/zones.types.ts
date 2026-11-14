export interface GeoPoint {
  lat: number;
  lng: number;
}

/** A delivery zone, matching logistics.zones. Polygon is a closed ring of points. */
export interface Zone {
  id: number;
  code: string;
  name: string;
  feeCents: number;
  freeOverCents?: number;
  polygon?: GeoPoint[];
}

export interface DeliveryQuote {
  deliverable: boolean;
  zone?: Zone;
  feeCents?: number;
}
