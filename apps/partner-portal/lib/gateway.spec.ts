import { describe, it, expect } from 'vitest';
import { bookedPct, slotsAvailable } from './portal-view';
import { FIXTURE_SLOTS } from './fixtures';

describe('gateway rows through the portal rules', () => {
  it('computes availability and fill from a live slot', () => {
    const slot = FIXTURE_SLOTS[0];
    expect(slotsAvailable(slot)).toBe(22);
    expect(bookedPct(slot)).toBe(82);
  });
});
