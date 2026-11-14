import { Slot } from '../slots/slots.types';
import { Route } from './routes.types';

/** Boxes a route can carry today, across its slots; falls back to the vehicle limit. */
export function routeCapacity(route: Route, slots: Slot[]): number {
  const fromSlots = slots.filter((s) => s.routeId === route.id).reduce((sum, s) => sum + s.capacity, 0);
  return fromSlots || route.capacityBoxes || 0;
}

export interface CapacityCheck {
  ok: boolean;
  capacity: number;
  booked: number;
  remaining: number;
}

/** Enforce route capacity: adding `boxes` must not exceed the route's capacity. */
export function checkRouteCapacity(route: Route, slots: Slot[], boxes: number): CapacityCheck {
  const capacity = routeCapacity(route, slots);
  const booked = slots.filter((s) => s.routeId === route.id).reduce((sum, s) => sum + s.booked, 0);
  return { ok: booked + boxes <= capacity, capacity, booked, remaining: Math.max(0, capacity - booked) };
}
