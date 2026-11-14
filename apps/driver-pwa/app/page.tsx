// Wireframe: docs/wireframes/index.html#dr-daypack
import Link from 'next/link';
import { DEMO_DAY_PACK } from '../lib/daypack-seed';
import { routeOrder } from '../lib/daypack';
import { formatTime } from '../lib/format';

export default function HomePage() {
  const pack = DEMO_DAY_PACK;
  const stops = routeOrder(pack);
  const first = stops[0];

  return (
    <section>
      <div className="bar">
        <strong>{pack.routeName}</strong>
        <span className="tag">Offline</span>
      </div>

      <div className="meter" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: '100%' }} />
      </div>
      <p className="p">Day pack downloaded {formatTime(pack.downloadedAt)}</p>

      <table className="tbl">
        <thead>
          <tr><th>#</th><th>Stop</th><th>Window</th></tr>
        </thead>
        <tbody>
          {stops.map((s) => (
            <tr key={s.id}>
              <td>{s.sequence}</td>
              <td><Link href={`/stop/${s.id}`}>{s.customer}</Link></td>
              <td>{s.window}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {first && <Link className="btn" href={`/stop/${first.id}`}>Start route</Link>}
    </section>
  );
}
