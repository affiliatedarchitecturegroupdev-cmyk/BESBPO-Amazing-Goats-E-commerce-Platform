import { describe, it, expect } from 'vitest';
import { dayPackIsFresh, nextStop, routeOrder, stopById, type DayPack } from './daypack';

const pack: DayPack = {
  routeName: 'Wed Durban',
  downloadedAt: '2026-11-18T05:40:00Z',
  stops: [
    { id: 's2', sequence: 2, customer: 'Bakery B', address: '12 Main Rd', window: '08:30', items: [{ name: '20 egg trays', qty: 20 }], temperature: 'chilled', requiresSignature: true },
    { id: 's1', sequence: 1, customer: 'Cafe A', address: '1 Long St', window: '08:00', items: [{ name: '10 kg lamb', qty: 1 }], temperature: 'chilled', requiresSignature: false },
  ],
};

describe('dayPackIsFresh', () => {
  it('is fresh when downloaded the same day and not empty', () => {
    expect(dayPackIsFresh(pack, new Date('2026-11-18T09:00:00Z'))).toBe(true);
  });
  it('is stale on a later day or when missing', () => {
    expect(dayPackIsFresh(pack, new Date('2026-11-19T09:00:00Z'))).toBe(false);
    expect(dayPackIsFresh(undefined, new Date('2026-11-18T09:00:00Z'))).toBe(false);
  });
});

describe('routeOrder and nextStop', () => {
  it('visits stops in sequence and advances to the next', () => {
    expect(routeOrder(pack).map((s) => s.id)).toEqual(['s1', 's2']);
    expect(nextStop(pack, 's1')?.id).toBe('s2');
    expect(nextStop(pack, 's2')).toBeNull();
  });
});

describe('stopById', () => {
  it('finds a stop or returns undefined', () => {
    expect(stopById(pack, 's2')?.customer).toBe('Bakery B');
    expect(stopById(pack, 'nope')).toBeUndefined();
  });
});
