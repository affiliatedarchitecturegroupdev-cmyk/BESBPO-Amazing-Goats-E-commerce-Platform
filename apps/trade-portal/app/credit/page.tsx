// Wireframe: docs/wireframes/index.html#tp-credit
import { TIER_LADDER, ladderHint, ladderPct, lulapayOffered, tierLabel } from '../../lib/application';
import { formatRand } from '../../lib/format';
import { loadCreditLimit } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

// LulaPay longer terms are a pilot, behind a feature flag (docs/05-payments.md).
const LULAPAY_ENABLED = process.env.NEXT_PUBLIC_LULAPAY_ENABLED === 'true';

export default async function CreditPage() {
  const { data: credit, error } = await loadCreditLimit();
  const tier = credit?.tier ?? 'new';
  const currentIndex = TIER_LADDER.indexOf(tier);

  return (
    <section>
      <p className="bar">Credit</p>
      {error && <p className="p" role="alert">{error}</p>}

      <ul className="chips">
        {TIER_LADDER.map((t, i) => (
          <li key={t} className={i === currentIndex ? 'on' : ''}>{tierLabel(t)}</li>
        ))}
      </ul>
      <meter value={ladderPct(tier)} min={0} max={100}>{ladderPct(tier)}%</meter>
      <p className="p">{ladderHint(tier, 0)}</p>

      <article className="card row">
        <div>
          <b>Longer terms with LulaPay</b>
          <br />
          <small>Pay in 30 to 60 days, we are paid now</small>
        </div>
        <span className="tag">{lulapayOffered(LULAPAY_ENABLED) ? 'Available' : 'Pilot'}</span>
      </article>

      {credit && (
        <p className="p">
          Current limit {formatRand(credit.limitCents)} over {credit.termsDays} day terms. Limits are reviewed monthly.
        </p>
      )}
    </section>
  );
}
