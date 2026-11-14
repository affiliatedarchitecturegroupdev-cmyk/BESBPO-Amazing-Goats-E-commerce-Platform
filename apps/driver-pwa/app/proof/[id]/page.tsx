// Wireframe: docs/wireframes/index.html#dr-proof
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { DEMO_DAY_PACK } from '../../../lib/daypack-seed';
import { stopById } from '../../../lib/daypack';
import { CHILLED_MAX_CELSIUS, formatCelsius, temperatureOutOfRange, validateProof } from '../../../lib/proof';
import { withId } from '../../../lib/offline-queue';
import { queue } from '../../../lib/queue-seed';
import { formatRand } from '../../../lib/format';

export default function ProofIdPage({ params }: { params: { id: string } }) {
  const stop = stopById(DEMO_DAY_PACK, params.id);
  const [signature, setSignature] = useState('');
  const [photo, setPhoto] = useState(false);
  const [celsius, setCelsius] = useState<number | undefined>(undefined);
  const [cash, setCash] = useState<number | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  if (!stop) {
    return (
      <section>
        <h1>Proof</h1>
        <p className="p">Stop not found in today&apos;s day pack.</p>
        <Link className="btn" href="/">Back to day pack</Link>
      </section>
    );
  }

  const check = validateProof({ stop, signatureDataUrl: signature || undefined, photoIds: photo ? ['p1'] : undefined, celsius, cashCents: cash });
  const outOfRange = celsius !== undefined && temperatureOutOfRange(celsius);

  async function save() {
    if (!check.ok) return;
    await queue.enqueue(withId({ type: 'delivered', stopId: stop!.id, at: new Date().toISOString(), signatureDataUrl: signature || undefined }));
    if (celsius !== undefined) await queue.enqueue(withId({ type: 'temperature', stopId: stop!.id, at: new Date().toISOString(), celsius }));
    if (cash !== undefined) await queue.enqueue(withId({ type: 'cash', stopId: stop!.id, at: new Date().toISOString(), amountCents: cash }));
    setSaved(true);
  }

  return (
    <section>
      <div className="bar"><strong>Proof: {stop.customer}</strong><span className="tag">Offline</span></div>

      {stop.requiresSignature && (
        <label className="fld">
          Signature
          <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type full name to sign" />
        </label>
      )}

      <label className="fld row">
        <span>Photo of drop</span>
        <input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} />
      </label>

      <label className="fld">
        Probe (chilled max {CHILLED_MAX_CELSIUS}°C)
        <input type="number" step="0.1" value={celsius ?? ''} onChange={(e) => setCelsius(e.target.value === '' ? undefined : Number(e.target.value))} />
      </label>
      {celsius !== undefined && (
        <div className="row">
          <span>Probe</span>
          <strong className={outOfRange ? 'warn' : undefined}>{formatCelsius(celsius)}</strong>
        </div>
      )}

      {stop.cashExpectedCents !== undefined && (
        <label className="fld">
          Cash taken (expected {formatRand(stop.cashExpectedCents)})
          <input type="number" value={cash ?? ''} onChange={(e) => setCash(e.target.value === '' ? undefined : Number(e.target.value))} />
        </label>
      )}

      {!check.ok && <p className="p warn">Still needed: {check.missing.join(', ')}</p>}

      <button className="btn" type="button" onClick={save} disabled={!check.ok}>Save (queued offline)</button>
      {saved && <p className="p">Saved to the offline queue. It will sync when signal returns.</p>}
      <Link className="btn btn-outline" href="/sync">View sync status</Link>
    </section>
  );
}
