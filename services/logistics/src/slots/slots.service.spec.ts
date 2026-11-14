import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { bookableSlots, isBookable, remaining } from './slot-domain';
import { SlotsService } from './slots.service';
import { InMemorySlotStore } from './slots.store';
import { Slot } from './slots.types';

const now = new Date('2026-11-18T06:00:00Z');
const slot = (over: Partial<Slot> = {}): Slot => ({
  id: 's1', routeId: 'r1', startsAt: '2026-11-19T06:00:00Z', endsAt: '2026-11-19T12:00:00Z',
  capacity: 20, booked: 0, earlyWindow: false, ...over,
});

describe('remaining', () => {
  it('never goes negative', () => {
    expect(remaining(slot({ booked: 5 }))).toBe(15);
    expect(remaining(slot({ booked: 25 }))).toBe(0);
  });
});

describe('isBookable', () => {
  it('needs room and an end time in the future', () => {
    expect(isBookable(slot(), now)).toBe(true);
    expect(isBookable(slot({ booked: 20 }), now)).toBe(false);
    expect(isBookable(slot({ endsAt: '2026-11-17T12:00:00Z' }), now)).toBe(false);
  });
});

describe('bookableSlots', () => {
  it('returns open slots earliest first and can filter to early windows', () => {
    const slots = [
      slot({ id: 'b', startsAt: '2026-11-20T06:00:00Z', endsAt: '2026-11-20T12:00:00Z' }),
      slot({ id: 'a', startsAt: '2026-11-19T06:00:00Z', endsAt: '2026-11-19T12:00:00Z' }),
      slot({ id: 'c', startsAt: '2026-11-19T05:00:00Z', endsAt: '2026-11-19T08:00:00Z', earlyWindow: true }),
      slot({ id: 'full', booked: 20 }),
    ];
    expect(bookableSlots(slots, now).map((s) => s.id)).toEqual(['c', 'a', 'b']);
    expect(bookableSlots(slots, now, { earlyOnly: true }).map((s) => s.id)).toEqual(['c']);
  });
});

describe('SlotsService', () => {
  const build = () => new SlotsService(new InMemorySlotStore([slot(), slot({ id: 'full', booked: 20 })]));

  it('books one box and refuses a full slot', async () => {
    const service = build();
    const ok = await service.book('s1', now);
    expect(ok.ok).toBe(true);
    expect(ok.slot.booked).toBe(1);
    const full = await service.book('full', now);
    expect(full.ok).toBe(false);
    expect(full.reason).toBe('full');
  });

  it('404s on an unknown slot', async () => {
    await expect(build().get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
