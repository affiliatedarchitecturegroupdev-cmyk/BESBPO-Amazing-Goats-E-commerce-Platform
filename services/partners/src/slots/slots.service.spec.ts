import { describe, it, expect } from 'vitest';
import { SlotsService } from './slots.service';
import { InMemoryPartnerStore } from '../partner.store';
import type { SlaughterSlot } from '../partner-domain';

const slot = (over: Partial<SlaughterSlot> = {}): SlaughterSlot => ({
  id: 'slot-1',
  orgId: 'org-1',
  date: 'Mon',
  capacity: 120,
  booked: 98,
  confirmed: false,
  halaal: true,
  ...over,
});

const service = (seed: SlaughterSlot[]) => new SlotsService(new InMemoryPartnerStore({ slots: seed }));

describe('SlotsService', () => {
  it('lists only the org’s own slots', async () => {
    const svc = service([slot(), slot({ id: 'slot-2', orgId: 'org-2' })]);
    expect((await svc.list('org-1')).map((s) => s.id)).toEqual(['slot-1']);
  });

  it('confirms a slot the org owns', async () => {
    const svc = service([slot()]);
    expect((await svc.confirm('org-1', 'slot-1')).confirmed).toBe(true);
  });

  it('refuses to confirm another org’s slot', async () => {
    const svc = service([slot({ orgId: 'org-2' })]);
    await expect(svc.confirm('org-1', 'slot-1')).rejects.toThrow(/not found/);
  });

  it('refuses to confirm an overbooked slot', async () => {
    const svc = service([slot({ booked: 121 })]);
    await expect(svc.confirm('org-1', 'slot-1')).rejects.toThrow(/overbooked/);
  });

  it('refuses to confirm a slot twice', async () => {
    const svc = service([slot({ confirmed: true })]);
    await expect(svc.confirm('org-1', 'slot-1')).rejects.toThrow(/already confirmed/);
  });
});
