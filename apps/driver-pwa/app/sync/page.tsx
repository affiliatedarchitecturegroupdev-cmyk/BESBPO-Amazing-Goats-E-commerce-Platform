// Wireframe: docs/wireframes/index.html#dr-sync
'use client';
import { useCallback, useEffect, useState } from 'react';
import { type QueuedEvent } from '../../lib/offline-queue';
import { queue, loadDemoQueue, DEVICE_ID, FIXTURE_DAY_PACK } from '../../lib/fixtures';
import { syncQueue } from '../../lib/sync';
import { canCloseDay, type DayCloseBlocker } from '../../lib/daypack';
import { createLedger, type DayLedger } from '../../lib/day-ledger';
import { formatTime } from '../../lib/format';

const ledger: DayLedger = createLedger(DEVICE_ID);

const BLOCKER_TEXT: Record<DayCloseBlocker, string> = {
  queue_not_drained: 'Sync before closing the day, or the queued captures are lost.',
  stops_remaining: 'Every stop must be delivered or refused before the day can close.',
};

export default function SyncPage() {
  const [pending, setPending] = useState<QueuedEvent[]>([]);
  const [lastSync, setLastSync] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState('Offline');
  const [proofs, setProofs] = useState(0);
  const [closeNote, setCloseNote] = useState<string | undefined>(undefined);
  const [closed, setClosed] = useState(false);
  const [completedStopIds, setCompletedStopIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    await loadDemoQueue();
    setPending(await queue.pending());
    setCompletedStopIds((await ledger.all()).map((s) => s.stopId));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function closeDay() {
    const verdict = canCloseDay({
      pack: FIXTURE_DAY_PACK,
      completedStopIds,
      pendingEvents: pending.length,
    });
    if (!verdict.ok) {
      setCloseNote(BLOCKER_TEXT[verdict.blocker]);
      return;
    }
    // Nothing is left to send and every stop is accounted for, so the day's
    // evidence is safely on the server and the local queue can go.
    await queue.clear();
    await ledger.clear();
    setClosed(true);
    setCloseNote('Day closed. Local queue cleared.');
    await refresh();
  }

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
        const result = (await res.json()) as { proofs?: number };
        setProofs(result.proofs ?? 0);
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
        {lastSync && <p className="p">{proofs} proof{proofs === 1 ? '' : 's'} of delivery stored</p>}
      </article>

      <p className="p">Driver events win for delivery status. Server wins for order content.</p>

      <p className="p">{completedStopIds.length} of {FIXTURE_DAY_PACK.stops.length} stops accounted for</p>

      <button className="btn" type="button" onClick={syncNow}>Sync now</button>
      <button className="btn btn-outline" type="button" onClick={refresh}>Refresh queue</button>
      <button className="btn btn-outline" type="button" onClick={closeDay} disabled={closed}>
        {closed ? 'Day closed' : 'Close day'}
      </button>

      {closeNote && <p className="p">{closeNote}</p>}
    </section>
  );
}
