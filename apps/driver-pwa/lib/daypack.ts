import type { Temperature } from '@ag/shared-types';

/** A stop on the day's route, as downloaded in the morning day pack. */
export interface Stop {
  id: string;
  sequence: number;
  customer: string;
  address: string;
  window: string;
  items: { name: string; qty: number }[];
  instructions?: string;
  /** Chilled goods need a probe reading before the drop is accepted. */
  temperature: Temperature;
  requiresSignature: boolean;
  cashExpectedCents?: number;
}

export interface DayPack {
  routeName: string;
  downloadedAt: string;
  stops: Stop[];
}

/** Downloaded once each morning, so the route works with no signal all day. */
export function dayPackIsFresh(pack: DayPack | undefined, now: Date): boolean {
  if (!pack) return false;
  const sameDay = pack.downloadedAt.slice(0, 10) === now.toISOString().slice(0, 10);
  return sameDay && pack.stops.length > 0;
}

export function stopById(pack: DayPack | undefined, id: string): Stop | undefined {
  return pack?.stops.find((s) => s.id === id);
}

/** Stops in the order the driver should visit them. */
export function routeOrder(pack: DayPack): Stop[] {
  return [...pack.stops].sort((a, b) => a.sequence - b.sequence);
}

/** The next stop after the one delivered, or null at the end of the route. */
export function nextStop(pack: DayPack, currentId: string): Stop | null {
  const ordered = routeOrder(pack);
  const i = ordered.findIndex((s) => s.id === currentId);
  return i >= 0 && i + 1 < ordered.length ? ordered[i + 1] : null;
}
