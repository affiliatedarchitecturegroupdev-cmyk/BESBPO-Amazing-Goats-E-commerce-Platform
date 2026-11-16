// Wireframe: docs/wireframes/index.html#dr-sync
'use client';
import { useCallback, useEffect, useState } from 'react';
import { type QueuedEvent } from '../../lib/offline-queue';
import { queue, loadDemoQueue } from '../../lib/fixtures';
import { syncQueue } from '../../lib/sync';
import { formatTime } from '../../lib/format';

const DEVICE_ID = 'dev-demo-1';

export default function SyncPage() {
  const [pending, setPending] = useState<QueuedEvent[]>([]);
  const [lastSync, setLastSync] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState('Offline');

  const refresh = useCallback(async () => {
    await loadDemoQueue();
    setPending(await queue.pending());
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function syncNow() {
    try {
      // Post to the same-origin route, which forwards to the gateway with the
      // server-held bearer token; the queue is trimmed only when it resolves.
      const count = await syncQueue(queue, async (events) => {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ events }),
        });
        if (!res.ok) throw new Error('sync failed');
      }, DEVICE_ID);
      setLastSync(new Date().toISOString());
      setStatus(count > 0 ? 'Synced' : 'Nothing to sync');
    } catch {
      setStatus('Still offline');
    } finally {
      await refresh();
    }
  }

  return (
    <section>
      <div className="bar"><strong>Sync</strong><span className="tag">{status}</span></div>

      <article className="card">
        <p>{pending.length} event{pending.length === 1 ? '' : 's'} waiting</p>
        <p className="p">Last sync {lastSync ? formatTime(lastSync) : 'not yet'}</p>
      </article>

      <p className="p">Driver events win for delivery status. Server wins for order content.</p>

      <button className="btn" type="button" onClick={syncNow}>Sync now</button>
      <button className="btn btn-outline" type="button" onClick={refresh}>Refresh queue</button>
    </section>
  );
}
