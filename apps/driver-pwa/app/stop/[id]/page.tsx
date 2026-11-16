// Wireframe: docs/wireframes/index.html#dr-stop
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { nextStop, stopById } from '../../../lib/daypack';
import { loadDayPack } from '../../../lib/gateway';
import { formatRand } from '../../../lib/format';

export const dynamic = 'force-dynamic';

export default async function StopIdPage({ params }: { params: { id: string } }) {
  const pack = await loadDayPack();
  const stop = stopById(pack, params.id);
  if (!stop) notFound();
  const next = nextStop(pack, stop.id);

  return (
    <section>
      <div className="bar">
        <strong>Stop {stop.sequence}: {stop.customer}</strong>
        <span className="tag">Offline</span>
      </div>

      <article className="card">
        <p>{stop.address}</p>
        <p className="p">Window {stop.window}</p>
        {stop.instructions && <p className="p">{stop.instructions}</p>}
      </article>

      {stop.items.map((it) => (
        <article key={it.name} className="card row">
          <span>{it.qty} × {it.name}</span>
          <span className="tag">{stop.temperature}</span>
        </article>
      ))}

      {stop.cashExpectedCents !== undefined && (
        <div className="row"><span>Cash expected</span><strong>{formatRand(stop.cashExpectedCents)}</strong></div>
      )}

      <Link className="btn" href={`/proof/${stop.id}`}>Arrived</Link>
      <Link className="btn" href={`/proof/${stop.id}`}>Delivered</Link>
      <Link className="btn btn-outline" href={next ? `/stop/${next.id}` : '/'}>Refused</Link>
    </section>
  );
}
