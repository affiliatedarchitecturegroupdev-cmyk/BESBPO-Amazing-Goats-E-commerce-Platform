// Wireframe: docs/wireframes/index.html#ad-payments
import { formatRand } from '../../lib/format';
import { loadSettlements } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const { data: settlements, error } = await loadSettlements();

  return (
    <section>
      <h1>Payments</h1>
      <p className="p">Provider settlements and reconciliation.</p>
      {error && <p className="p" role="alert">{error}</p>}

      {settlements.length === 0 && !error && <p className="p">No settlements yet.</p>}

      <table className="tbl">
        <thead>
          <tr><th>Provider</th><th>Period</th><th>Gross</th><th>Fees</th><th>Net</th><th>Bank ref</th><th>Matched</th></tr>
        </thead>
        <tbody>
          {settlements.map((s) => (
            <tr key={s.id}>
              <td>{s.provider}</td>
              <td>{s.periodStart} – {s.periodEnd}</td>
              <td>{formatRand(s.grossCents)}</td>
              <td>{formatRand(s.feesCents)}</td>
              <td>{formatRand(s.netCents)}</td>
              <td>{s.bankRef}</td>
              <td><span className={s.matched ? 'tag' : 'tag tag-watch'}>{s.matched ? 'Matched' : 'Exception'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
