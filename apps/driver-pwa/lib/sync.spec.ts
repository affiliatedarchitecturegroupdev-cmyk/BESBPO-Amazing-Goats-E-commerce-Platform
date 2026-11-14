import { describe, it, expect } from 'vitest';
import { MemoryQueue } from './offline-queue';
import { syncQueue } from './sync';

describe('syncQueue', () => {
  it('posts pending events and clears them', async () => {
    const q = new MemoryQueue(); const posted: unknown[][] = [];
    await q.enqueue({ type: 'arrived', stopId: 's1', at: '2026-11-18T05:00:00Z' });
    expect(await syncQueue(q, async (e) => { posted.push(e); })).toBe(1);
    expect(await q.pending()).toEqual([]); expect(posted.length).toBe(1);
  });
  it('does nothing when the queue is empty', async () => { expect(await syncQueue(new MemoryQueue(), async () => {})).toBe(0); });
});
