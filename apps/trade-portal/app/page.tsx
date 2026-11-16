// Wireframe: docs/wireframes/index.html#tp-dashboard
import Link from 'next/link';
import { creditAvailableCents, creditUsagePct, ladderHint, tierLabel } from '../lib/application';
import { formatRand } from '../lib/format';
import { loadCreditLimit, loadStatement } from '../lib/gateway';

// The account is live, so the page renders per request.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [{ data: credit, error }, { data: statement }] = await Promise.all([loadCreditLimit(), loadStatement()]);

  if (!credit) {
    return (
      <section>
        <p className="bar">Welcome back</p>
        {error && <p className="p" role="alert">{error}</p>}
        <p><Link href="/apply">Apply for a trade account</Link></p>
      </section>
    );
  }

  const usedCents = statement?.balanceCents ?? 0;
  const usage = creditUsagePct(credit.limitCents, usedCents);
  const dueLines = statement?.lines.filter((l) => l.daysOverdue >= 0) ?? [];

  return (
    <section>
      <p className="bar">Welcome back <span className="tag">{tierLabel(credit.tier)}</span></p>

      <article className="card">
        <h2>Credit available</h2>
        <div className="row">
          <strong>{formatRand(creditAvailableCents(credit.limitCents, usedCents))}</strong>
          <span>of {formatRand(credit.limitCents)}</span>
        </div>
        <meter value={usage} min={0} max={100}>{usage}% used</meter>
        <p className="p">{usage}% used · {ladderHint(credit.tier, 0)}</p>
      </article>

      <div className="row">
        <button className="btn" type="button">Repeat last order</button>
        <Link className="btn" href="/order">New order</Link>
      </div>

      <h2>Alerts</h2>
      {dueLines.length === 0 && <p className="p">No invoices due.</p>}
      {dueLines.map((line) => (
        <article key={line.invoiceId} className="card row">
          <span>Invoice {line.number} due {line.dueOn}</span>
          <Link className="btn" href="/statements">Pay</Link>
        </article>
      ))}
    </section>
  );
}
