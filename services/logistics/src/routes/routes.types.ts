/** A delivery route, matching logistics.routes. */
export interface Route {
  id: string;
  name: string;
  dayOfWeek: number;
  zoneId?: number;
  vehicleId?: string;
  capacityBoxes?: number;
}
