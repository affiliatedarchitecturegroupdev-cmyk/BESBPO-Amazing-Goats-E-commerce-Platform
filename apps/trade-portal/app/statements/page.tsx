// Wireframe: docs/wireframes/index.html#tp-statements
import { formatRand } from '../../lib/format';
import { loadStatement } from '../../lib/gateway';

export const dynamic = 'force-dynamic';

export default async function StatementsPage() {
  const { data: statement, error } = await loadStatement();

  return (
    <section>
      <p className="bar">Statements</p>
      {error && <p className="p" role="alert">{error}</p>}

      <div className="row">
        <span>Balance</span>
        <strong>{formatRand(statement?.balanceCents ?? 0)}</strong>
      </div>

      <table className="tbl">
        <thead>
          <tr><th>Invoice</th><th>Due</th><th>Status</th></tr>
        </thead>
        <tbody>
          {(statement?.lines ?? []).map((row) => (
            <tr key={row.invoiceId}>
              <td>{row.number}</td>
              <td>{row.dueOn}</td>
              <td>{row.daysOverdue > 0 ? <button className="btn" type="button">Pay</button> : <span className="tag">Due</span>}</td>
            </tr>
          ))}
          {statement && statement.lines.length === 0 && (
            <tr><td colSpan={3}>Nothing outstanding.</td></tr>
          )}
        </tbody>
      </table>

      <button className="btn" type="button">Open a dispute (photo and temperature)</button>
      <button className="btn" type="button">Download VAT invoices</button>
      <p className="p">Disputes are open for 24 hours after delivery, with photo and temperature evidence.</p>
    </section>
  );
}
