import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CyclesService } from './cycles.service';
import { CycleScheduler } from './cycle.scheduler';
import { InMemoryCycleStore } from './cycle.store';
import { generateCycle } from './cycle-engine';

const NOW = new Date('2026-11-11T10:00:00Z');
const CUTOFF = '2026-11-15T15:00:00.000Z';

describe('CyclesService', () => {
  it('lists cycles by cut-off', async () => {
    const store = new InMemoryCycleStore([generateCycle(NOW)]);
    const service = new CyclesService(store);
    expect(await service.list()).toHaveLength(1);
  });

  it('current returns the next upcoming cycle', async () => {
    const store = new InMemoryCycleStore([generateCycle(NOW)]);
    const service = new CyclesService(store);
    expect((await service.current(NOW))?.cutoffAt).toBe(CUTOFF);
  });

  it('current falls back to the most recent cycle when none is upcoming', async () => {
    const store = new InMemoryCycleStore([{ ...generateCycle(NOW), status: 'closed' }]);
    const service = new CyclesService(store);
    const current = await service.current(new Date('2026-11-20T00:00:00Z'));
    expect(current?.status).toBe('closed');
  });

  it('current is null on an empty store', async () => {
    expect(await new CyclesService(new InMemoryCycleStore()).current(NOW)).toBeNull();
  });

  it('tick generates a cycle', async () => {
    const store = new InMemoryCycleStore();
    const report = await new CyclesService(store).tick(NOW);
    expect(report.generated).toEqual([`chilled_meat:${CUTOFF}`]);
  });
});

describe('CycleScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs a tick on init and on the interval, and stops on destroy', async () => {
    const store = new InMemoryCycleStore();
    const service = new CyclesService(store);
    const scheduler = new CycleScheduler(service);
    const spy = vi.spyOn(service, 'tick');

    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(900_000);
    expect(spy).toHaveBeenCalledTimes(2);

    scheduler.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(900_000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('swallows tick errors so the interval keeps running', async () => {
    const service = new CyclesService(new InMemoryCycleStore());
    vi.spyOn(service, 'tick').mockRejectedValue(new Error('db down'));
    const scheduler = new CycleScheduler(service);
    await expect(scheduler.tick(NOW)).resolves.toBeUndefined();
  });
});
