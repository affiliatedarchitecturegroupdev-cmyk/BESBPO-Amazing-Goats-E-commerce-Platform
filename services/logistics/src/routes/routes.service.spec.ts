import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { checkRouteCapacity, routeCapacity } from './route-domain';
import { RoutesService } from './routes.service';
import { InMemoryRouteStore } from './routes.store';
import { InMemorySlotStore } from '../slots/slots.store';
import { Route } from './routes.types';
import { Slot } from '../slots/slots.types';

const route: Route = { id: 'r1', name: 'Sandton Tue', dayOfWeek: 2, zoneId: 1, capacityBoxes: 40 };
const slot = (over: Partial<Slot> = {}): Slot => ({
  id: 's1', routeId: 'r1', startsAt: '2026-11-19T06:00:00Z', endsAt: '2026-11-19T12:00:00Z',
  capacity: 20, booked: 0, earlyWindow: false, ...over,
});

describe('routeCapacity', () => {
  it('sums slot capacity, falling back to the vehicle limit', () => {
    expect(routeCapacity(route, [slot(), slot({ id: 's2' })])).toBe(40);
    expect(routeCapacity(route, [])).toBe(40);
    expect(routeCapacity({ ...route, capacityBoxes: undefined }, [])).toBe(0);
  });
});

describe('checkRouteCapacity', () => {
  it('allows a load within capacity and refuses one that exceeds it', () => {
    const slots = [slot({ booked: 30 }), slot({ id: 's2' })];
    expect(checkRouteCapacity(route, slots, 5)).toMatchObject({ ok: true, capacity: 40, booked: 30, remaining: 10 });
    expect(checkRouteCapacity(route, slots, 11).ok).toBe(false);
  });
});

describe('RoutesService', () => {
  const build = () => new RoutesService(
    new InMemoryRouteStore([route]),
    new InMemorySlotStore([slot({ booked: 35 }), slot({ id: 's2', capacity: 5, booked: 5 })]),
  );

  it('enforces route capacity', async () => {
    const check = await build().capacity('r1', 1);
    expect(check).toMatchObject({ ok: false, capacity: 25, booked: 40, remaining: 0 });
  });

  it('404s on an unknown route', async () => {
    await expect(build().get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
