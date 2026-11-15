// Wireframe: docs/wireframes/index.html#tp-dashboard
import Link from 'next/link';
import { creditAvailableCents, creditUsagePct, ladderHint, tierLabel } from '../lib/application';
import { DEMO_ACCOUNT, DEMO_ALERTS } from '../lib/seed';
import { formatRand } from '../lib/format';

export default function HomePage() {
  const { tier, limitCents, usedCents, monthsClean } = DEMO_ACCOUNT;
  const usage = creditUsagePct(limitCents, usedCents);
  return (
    <section>
      <p className="bar">Welcome back <span className="tag">{tierLabel(tier)}</span></p>

      <article className="card">
        <h2>Credit available</h2>
        <div className="row">
          <strong>{formatRand(creditAvailableCents(limitCents, usedCents))}</strong>
          <span>of {formatRand(limitCents)}</span>
        </div>
        <meter value={usage} min={0} max={100}>{usage}% used</meter>
        <p className="p">{usage}% used · {ladderHint(tier, monthsClean)}</p>
      </article>

      <article className="card row">
        <div>
          <b>Next delivery</b>
          <br />
          <small>{DEMO_ACCOUNT.nextDelivery}</small>
        </div>
      </article>

      <div className="row">
        <button className="btn" type="button">Repeat last order</button>
        <Link className="btn" href="/order">New order</Link>
      </div>

      <h2>Alerts</h2>
      {DEMO_ALERTS.map((alert) => (
        <article key={alert.id} className="card row">
          <span>{alert.text}</span>
          <button className="btn" type="button">{alert.action}</button>
        </article>
      ))}
    </section>
  );
}
