'use client';
import { useEffect, useRef, useState } from 'react';
import type { AreaCheck } from '@ag/api-client';
import { areaCheckView } from '../lib/area-check';
import { isAskable } from '../lib/area-check-cache';

/**
 * The delivery-area checker (T-078): "do you deliver to me, when, and for how
 * much", answered before checkout and without a login.
 *
 * The browser asks the storefront's own `/api/area-check` route, which holds the
 * gateway address and the per-area cache. Typing is debounced, so a keystroke is
 * not a request; the answer appears once the field settles.
 */

/** How long the field must be still before it is asked about. */
export const DEBOUNCE_MS = 400;

type Status = 'idle' | 'asking' | 'answered' | 'failed';

export function DeliveryAreaCheck({
  goodsTotalCents,
  initialSuburb,
}: {
  /** The cart's goods total, so the zone's free-over threshold can apply. */
  goodsTotalCents?: number;
  initialSuburb?: string;
}) {
  const [suburb, setSuburb] = useState(initialSuburb ?? '');
  const [check, setCheck] = useState<AreaCheck | undefined>();
  const [status, setStatus] = useState<Status>('idle');
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const area = { suburb, goodsTotalCents };
    if (!isAskable(area)) {
      setCheck(undefined);
      setStatus('idle');
      return;
    }
    const ticket = ++latest.current;
    setStatus('asking');
    const id = setTimeout(async () => {
      const params = new URLSearchParams({ suburb });
      if (goodsTotalCents !== undefined) params.set('goodsTotalCents', String(goodsTotalCents));
      try {
        const res = await fetch(`/api/area-check?${params.toString()}`);
        const body = (await res.json()) as AreaCheck;
        // A later keystroke has already asked a newer question; ignore this one.
        if (ticket !== latest.current) return;
        setCheck(body);
        setStatus(res.ok ? 'answered' : 'failed');
      } catch {
        if (ticket !== latest.current) return;
        setStatus('failed');
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [suburb, goodsTotalCents]);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source: `delivery-waitlist:${suburb}` }),
    }).catch(() => undefined);
    setJoined(true);
  }

  const view = check ? areaCheckView(check) : undefined;

  return (
    <section className="card" aria-live="polite">
      <h2>Delivery to your area</h2>
      <label htmlFor="area-suburb">Suburb or postal code</label>
      <input
        id="area-suburb"
        name="suburb"
        type="text"
        autoComplete="postal-code"
        value={suburb}
        onChange={(e) => setSuburb(e.target.value)}
        placeholder="e.g. Umhlanga or 4051"
      />

      {status === 'asking' && <p className="p">Checking…</p>}
      {status === 'failed' && (
        <p className="p" role="status">
          We could not check that area just now. Please try again.
        </p>
      )}

      {view && status === 'answered' && (
        <div role="status">
          <h3>{view.headline}</h3>
          <p className="p">{view.detail}</p>
        </div>
      )}

      {view?.tone === 'unserved' && status === 'answered' && (
        <form onSubmit={join}>
          {joined ? (
            <p role="status">Thank you. We will email you when we deliver to your area.</p>
          ) : (
            <>
              <label htmlFor="area-email">Email</label>
              <input
                id="area-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <button type="submit">Tell me when you deliver here</button>
              <p className="p">
                We will only email you about your area, and you can unsubscribe from any message.
              </p>
            </>
          )}
        </form>
      )}
    </section>
  );
}
