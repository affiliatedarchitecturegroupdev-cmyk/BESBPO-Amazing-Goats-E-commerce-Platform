import { describe, it, expect } from 'vitest';
import { SlotsController } from './slots.controller';
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

const controller = (seed: SlaughterSlot[]) => new SlotsController(new SlotsService(new InMemoryPartnerStore({ slots: seed })));

// The guard puts the resolved user on the request; the dev shim and JWT paths
// are covered in @ag/nest-auth.
const req = (orgId: string, roles: any[] = ['procurement']) => ({ user: { id: 'u1', roles, orgId } });

describe('SlotsController scoping', () => {
  it('returns only the caller’s own slots, even if another org is requested', async () => {
    const ctl = controller([slot(), slot({ id: 'slot-2', orgId: 'org-2' })]);
    expect((await ctl.list(req('org-1'), 'org-2')).map((s: SlaughterSlot) => s.id)).toEqual(['slot-1']);
  });

  it('confirms a slot the caller owns', async () => {
    const ctl = controller([slot()]);
    expect((await ctl.confirm(req('org-1'), 'slot-1', undefined)).confirmed).toBe(true);
  });

  it('refuses to confirm another org’s slot', async () => {
    const ctl = controller([slot({ orgId: 'org-2' })]);
    await expect(ctl.confirm(req('org-1'), 'slot-1', undefined)).rejects.toThrow(/not found/);
  });

  it('lets internal staff act for a named org', async () => {
    const ctl = controller([slot({ orgId: 'org-9' })]);
    const staff = { user: { id: 'u2', roles: ['procurement'] } }; // internal staff carry no partner org
    expect((await ctl.list(staff, 'org-9')).map((s: SlaughterSlot) => s.id)).toEqual(['slot-1']);
  });
});
