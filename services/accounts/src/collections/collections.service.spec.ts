import { describe, it, expect } from 'vitest';
import { CollectionsService } from './collections.service';
import { InMemoryCollectionsStore } from './collections.store';

describe('CollectionsService', () => {
  it('schedules the six dunning steps for an invoice', async () => {
    const svc = new CollectionsService(new InMemoryCollectionsStore());
    const plan = await svc.schedule('inv-1', '2025-11-14');
    expect(plan.map((a) => a.step)).toEqual([
      'reminder_pre', 'due_notice', 'reminder_1', 'call_7', 'hold_14', 'demand_30',
    ]);
    expect((await svc.list())).toHaveLength(6);
  });

  it('reports the steps due by a date and marks one done', async () => {
    const svc = new CollectionsService(new InMemoryCollectionsStore());
    const plan = await svc.schedule('inv-1', '2025-11-14');
    expect((await svc.due('2025-11-15')).map((a) => a.step)).toEqual([
      'reminder_pre', 'due_notice', 'reminder_1',
    ]);

    const done = await svc.markDone(plan[0].id, 'user-1', '2025-11-11T09:00:00.000Z');
    expect(done.doneAt).toBe('2025-11-11T09:00:00.000Z');
    // reminder_pre is done, so the next step due on the due date is the due notice.
    expect(await svc.nextStepFor('inv-1', '2025-11-14')).toBe('due_notice');
  });

  it('holds standing orders from day 14', () => {
    const svc = new CollectionsService(new InMemoryCollectionsStore());
    expect(svc.shouldHold(13)).toBe(false);
    expect(svc.shouldHold(14)).toBe(true);
  });
});
