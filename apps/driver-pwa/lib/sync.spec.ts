import { describe, it, expect } from 'vitest';
import { MemoryQueue, withId } from './offline-queue';
import { syncQueue, toServerEvent } from './sync';

describe('toServerEvent', () => {
  it('keeps the client-generated id and flattens the rest into the payload', () => {
    const e = toServerEvent({ type: 'temperature', id: 'abc', stopId: 's1', at: '2026-11-18T06:05:00Z', celsius: 3.4 }, 'dev-1');
    expect(e).toEqual({
      id: 'abc', deviceId: 'dev-1', type: 'temperature', stopId: 's1',
      occurredAt: '2026-11-18T06:05:00Z', payload: { celsius: 3.4 },
    });
  });
});

describe('syncQueue', () => {
  it('posts pending events and clears them', async () => {
    const q = new MemoryQueue();
    const posted: unknown[][] = [];
    await q.enqueue({ type: 'arrived', id: 'e1', stopId: 's1', at: '2026-11-18T05:00:00Z' });
    expect(await syncQueue(q, async (e) => { posted.push(e); }, 'dev-1')).toBe(1);
    expect(await q.pending()).toEqual([]);
    expect(posted[0][0]).toMatchObject({ id: 'e1', deviceId: 'dev-1', type: 'arrived' });
  });

  it('keeps the queue intact when the post fails, so nothing is lost offline', async () => {
    const q = new MemoryQueue();
    await q.enqueue({ type: 'delivered', id: 'e1', stopId: 's1', at: '2026-11-18T05:00:00Z' });
    await expect(syncQueue(q, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(await q.pending()).toHaveLength(1);
  });

  it('does nothing when the queue is empty', async () => {
    expect(await syncQueue(new MemoryQueue(), async () => {})).toBe(0);
  });

  it('syncs a whole offline day in one batch', async () => {
    const q = new MemoryQueue();
    for (let i = 0; i < 7; i++) await q.enqueue(withId({ type: 'arrived', stopId: `s${i}`, at: '2026-11-18T05:00:00Z' }));
    expect(await syncQueue(q, async () => {}, 'dev-1')).toBe(7);
    expect(await q.pending()).toEqual([]);
  });
});
